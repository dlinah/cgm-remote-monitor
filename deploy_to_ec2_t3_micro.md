# deploy to ec2 t3.micro

1. create a basic linux t3.micro instance with public network access
2. ssh into the instance
3. install node.js npm python3 python3-pip git

```
sudo dnf install -y python3 python3-pip git

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
# in lieu of restarting the shell
\. "$HOME/.nvm/nvm.sh"
# Download and install Node.js:
nvm install 16
# Verify the Node.js version:
node -v # Should print "v18".
# Verify npm version:
npm -v # Should print "11.8.0".
# set the default node version to 16
nvm alias default 16


4. clone the repository

```

git clone https://github.com/dlinah/cgm-remote-monitor.git

```

5. put your envs in .bashrc, example:

```

echo 'export NS_URL="https://my-cgm.duckdns.org/"' >> .env
echo 'export NS_URL="https://my-cgm.duckdns.org/"' >> .bashrc

````

5. install dependencies, because the instance is too small to run the postinstall script, will need to run webpack locally and upload the files to the server
    1. on server, run: npm i , it will install the dependencies and fail the postinstall script
    2. on your pc, run: nvm use 18 && npm i, it will install the dependencies and run the postinstall script
    3. upload the /node_modules/.cache/_ns_cache file to the ec2 server
       ```
       scp -i "~/.ssh/dia-aws.pem" -r node_modules/.cache/_ns_cache/ ec2-user@ec2-52-23-238-27.compute-1.amazonaws.com:/home/ec2-user/cgm-remote-monitor/node_modules/.cache/
       ```
5.1 install python3 dependencies for dm2nsc
    ```
    python3 -m pip install -r dm2nsc/requirements.txt
    ```

6. setup nginx to proxy the requests to the server
    ```
    sudo dnf install -y nginx
    sudo nano /etc/nginx/conf.d/default.conf
    ```
    ```
    # add the following to the file /etc/nginx/sites-available/default
    server {
        listen 80 default_server;
        listen [::]:80 default_server;
        server_name _;

        location / {
            proxy_pass http://127.0.0.1:7880;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
        }
    }
    ```
    ```
    sudo nginx -t && sudo systemctl enable nginx && sudo systemctl restart nginx
    ```
7. setup pm2 to run the server
    ```
    npm install -g pm2
    pm2 start npm --name "cgm" -- start
    pm2 save
    pm2 startup
    ```

````

8.  (optional) setup ssl 
1. `sudo dnf install certbot python3-certbot-nginx -y` 
2. `sudo nano /etc/nginx/conf.d/default.conf` should look like this:
    ```
    server {
    listen 80;
    server_name my-cgm.duckdns.org www.my-cgm.duckdns.org;

        location / {
            proxy_pass http://127.0.0.1:7880;  # Your PM2 app port
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_cache_bypass $http_upgrade;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }

    }

````
3. bash:
```
sudo nginx -t && sudo systemctl restart nginx
sudo certbot --nginx -d my-cgm.duckdns.org -d www.my-cgm.duckdns.org

# automatically renew the certificate
# Test renewal
        sudo certbot renew --dry-run

        # Certbot automatically adds a renewal cron job, verify it:
        sudo systemctl status certbot-renew.timer

        # Or check cron
        sudo crontab -l
```
tea

