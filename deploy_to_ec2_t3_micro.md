# deploy to ec2 t3.micro

1. create a basic linux t3.micro instance with public network access
2. ssh into the instance
3. install node.js and npm

```
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

curl -L -o cgm-remote-monitor.zip https://github.com/dlinah/cgm-remote-monitor/archive/refs/heads/master.zip
unzip cgm-remote-monitor.zip

```

5. put your envs in .bashrc, example:

```

echo '
export INSECURE_USE_HTTP="true"' >> .bashrc

````

5. install dependencies, because the instance is too small to run the postinstall script, will need to run webpack locally and upload the files to the server
    1. on server, run: npm i , it will install the dependencies and fail the postinstall script
    2. on your pc, run: nvm use 18 && npm i, it will install the dependencies and run the postinstall script
    3. upload the /node_modules/.cache/_ns_cache file to the ec2 server
       ```
       scp -i "dia-aws.pem" -r node_modules/.cache/_ns_cache/ ec2-user@ec2-3-87-245-201.compute-1.amazonaws.com:/home/ec2-user/cgm-remote-monitor-master/node_modules/.cache/_ns_cache/

6. setup nginx to proxy the requests to the server
    ```
    sudo dnf install -y nginx
    sudo nano /etc/nginx/sites-available/default
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
    pm2 start npm --name "cgm-remote-monitor" -- start
    pm2 save
    pm2 startup
    ```

````
