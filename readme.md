Deployment Instructions for UBUNTU

sudo apt update

sudo apt install git -y

curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 20

nvm use 20
nvm alias default 20

node -v
npm -v

sudo apt install nginx -y

sudo systemctl start nginx
sudo systemctl enable nginx

sudo apt install build-essential python3 -y

sudo npm install pm2 -g

git clone https://github.com/pgotthardtuno/SimpleSocialCloudGame.git .

npm install

npm run build

nano .env

// PUT THIS BLOCK INTO THE .ENV FILE AND SAVE IT //

PORT=3000
JWT_SECRET="H27&si&go*8sgFSHS"

// END .ENV FILE //

sudo rm /etc/nginx/sites-enabled/default

sudo nano /etc/nginx/sites-available/social-game
        
// PUT THIS BLOCK INTO YOUR nginx.conf AND SAVE IT //
        server {
            listen 80 default_server;
            listen [::]:80 default_server;

            # Replace _ with your domain or EC2 public IP
            server_name _;

            # Optional: Set up logging
            access_log /var/log/nginx/social-game.access.log;
            error_log /var/log/nginx/social-game.error.log;

            # Root directory (optional, Nginx won't serve static files directly here)
            # root /var/www/social-game/public;
            # index index.html index.htm;

            location / {
                proxy_pass http://localhost:3000; # Forward requests to your Node app on port 3000
                proxy_http_version 1.1;
                proxy_set_header Upgrade $http_upgrade; # Important for WebSockets
                proxy_set_header Connection 'upgrade';   # Important for WebSockets
                proxy_set_header Host $host;
                proxy_set_header X-Real-IP $remote_addr;
                proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
                proxy_set_header X-Forwarded-Proto $scheme;
                proxy_cache_bypass $http_upgrade;
                proxy_read_timeout 86400s; # Keep long timeouts if WebSockets need them
                proxy_send_timeout 86400s;
            }
        }

// END NGINX.CONF FILE //

sudo ln -s /etc/nginx/sites-available/social-game /etc/nginx/sites-enabled/

sudo systemctl restart nginx

pm2 start dist/server/index.js --name social-game

// EC2 SECURITY RULES //

INBOUND: 
http (port 80) - 0.0.0.0
    
        