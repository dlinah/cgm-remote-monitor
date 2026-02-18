import requests, json, arrow, hashlib, urllib, datetime
import cloudscraper
import os
from pathlib import Path
from typing import Iterable, List, Dict, Any

import certifi
from dotenv import load_dotenv

# Load .env from script dir or repo root (when run as python3 dm2nsc/getdata.py)
_load_env_paths = [
	Path(__file__).resolve().parent / ".env",
	Path(__file__).resolve().parent.parent / ".env",
]
for _p in _load_env_paths:
	if _p.exists():
		load_dotenv(_p)
		break

def _required_env(name: str) -> str:
	val = os.getenv(name)
	if not val:
		print(f"Missing env var `{name}`. Put it in .env or export it.")
		return None
	return val

USERNAME = os.environ['USERNAME'] or _required_env('USERNAME')
PASSWORD = os.environ['PASSWORD'] or _required_env('PASSWORD')
NS_URL = os.environ['NS_URL'] or _required_env('NS_URL').rstrip('/') + '/'
NS_SECRET = os.environ['NS_SECRET'] or _required_env('NS_SECRET')
DBM_HOST = 'https://analytics.diabetes-m.com'

# Use certifi bundle so macOS/Python installs without system certs still work.
VERIFY = certifi.where()

# this is the enteredBy field saved to Nightscout
NS_AUTHOR = "Diabetes-M (dm2nsc)"


def get_login():
	sess = cloudscraper.create_scraper(
		browser={
			'browser': 'chrome',
			'platform': 'windows',
			'desktop': True
		}
	)
	
	index = sess.get(DBM_HOST + '/login', verify=VERIFY)

	return sess.post(DBM_HOST + '/api/v1/user/authentication/login', json={
		'username': USERNAME,
		'password': PASSWORD,
		'device': ''
	}, headers={
		'origin': DBM_HOST,
		'referer': DBM_HOST + '/login'
	}, cookies=index.cookies, verify=VERIFY), sess


def get_entries(login, sess):
	auth_code = login.json()['token']
	print("Loading entries...")
	entries = sess.post(DBM_HOST + '/api/v1/diary/entries/list', 
		cookies=login.cookies, 
		headers={
			'origin': DBM_HOST,
			'authorization': 'Bearer '+auth_code
		}, json={
			'fromDate': -1,
			'toDate': -1,
			'page_count': 90000,
			'page_start_entry_time': 0
		}, verify=VERIFY)
	return entries.json()


def to_mgdl(mmol):
	return round(mmol*18)

def convert_nightscout(entries, start_time=None):
	out = []
	start_arrow = arrow.get(start_time) if start_time else None
	for entry in entries:
		bolus = entry["carb_bolus"] + entry["correction_bolus"]
		time = arrow.get(int(entry["entry_time"])/1000).to(entry["timezone"])
		notes = entry["notes"]

		if start_arrow and start_arrow >= time:
			continue

		author = NS_AUTHOR

		# You can do some custom processing here, if necessary

		dat = {
			"eventType": "Meal Bolus",
			"created_at": time.format(),
			"carbs": entry["carbs"],
			"insulin": bolus,
			"notes": notes,
			"enteredBy": author
		}
		if entry["glucose"]:
			bgEvent = {
				"eventType": "BG Check",
				"glucoseType": "Finger",
			}
			# entry["glucose"] is always in mmol/L, but entry["glucoseInCurrentUnit"] is either mmol/L or mg/dL depending on account settings
			# entry["us_units"] appears to always be false, even if your account is set to mg/dL, so it is ignored for now
			unit_mmol = (entry["glucoseInCurrentUnit"] == entry["glucose"])

			# for mmol/L units, if no carbs or bolus is present then we upload with mmol/L units
			# to nightscout, otherwise we use the converted mg/dL as normal.
			# this is due to a UI display issue with Nightscout (it will show mg/dL units always for
			# bg-only readings, but convert to the NS default unit otherwise)
			if unit_mmol and not (entry["carbs"] or bolus):
				bgEvent["units"] = "mmol"
				# save the mmol/L value from DB-M
				bgEvent["glucose"] = entry["glucose"]
			else:
				bgEvent["units"] = "mg/dL"
				# convert mmol/L -> mg/dL
				bgEvent["glucose"] = to_mgdl(entry["glucose"])

			dat.update(bgEvent)

		if entry["hba1c"]:
			dat["eventType"] = "HbA1c"
			dat["hba1c"] = entry["hba1c"]
			dat["notes"] = "HbA1c %s%s" % (entry["hba1c"], '%')

		out.append(dat)

	return out

def _chunked(items: List[Dict[str, Any]], chunk_size: int) -> Iterable[List[Dict[str, Any]]]:
	for i in range(0, len(items), chunk_size):
		yield items[i:i + chunk_size]

def upload_nightscout(ns_format: List[Dict[str, Any]]):
	# Posting tens of thousands of treatments at once can exceed nginx/client_max_body_size,
	# resulting in HTTP 413. Upload in smaller chunks.
	chunk_size = int(os.getenv("NS_UPLOAD_CHUNK_SIZE", "1000"))
	if chunk_size < 1:
		chunk_size = 1000

	url = NS_URL + 'api/v1/treatments?api_secret=' + NS_SECRET
	headers = {
		'Accept': 'application/json',
		'Content-Type': 'application/json',
		'api-secret': hashlib.sha1(NS_SECRET.encode()).hexdigest()
	}

	total = len(ns_format)
	uploaded = 0
	for idx, chunk in enumerate(_chunked(ns_format, chunk_size), start=1):
		upload = requests.post(url, json=chunk, headers=headers, verify=VERIFY)
		uploaded += len(chunk)
		print(f"Nightscout upload chunk {idx}: {upload.status_code} ({uploaded}/{total})")
		if upload.status_code >= 300:
			print("Nightscout error body:", upload.text)
			return

def get_last_nightscout():
	last = requests.get(NS_URL + 'api/v1/treatments?count=1000&find[enteredBy]='+urllib.parse.quote(NS_AUTHOR), verify=VERIFY)
	if last.status_code == 200:
		js = last.json()
		if len(js) > 0:
			return arrow.get(js[0]['created_at']).datetime

def main():
	print("Logging in to Diabetes-M...", datetime.datetime.now())
	login, sess = get_login()
	if login.status_code == 200:
		entries = get_entries(login, sess)
	else:
		print("Error logging in to Diabetes-M: ",login.status_code, login.text)
		exit(0)

	print("Loaded", len(entries["logEntryList"]), "entries")

	# skip uploading entries past the last entry
	# uploaded to Nightscout by `NS_AUTHOR`
	ns_last = get_last_nightscout()

	ns_format = convert_nightscout(entries["logEntryList"], ns_last)

	print("Converted", len(ns_format), "entries to Nightscout format")

	print("Uploading", len(ns_format), "entries to Nightscout...")
	upload_nightscout(ns_format)



if __name__ == "__main__":
	main()