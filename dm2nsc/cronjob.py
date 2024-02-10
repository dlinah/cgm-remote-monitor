import schedule
import time
from index import main


# Run the function every 1 hour
schedule.every(5).seconds.do(main)

while True:
    schedule.run_pending()
    time.sleep(1)

