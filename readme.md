Deployment Instructions for UBUNTU

# Update package lists
sudo apt update

# Install Node.js (using NodeSource for a recent version)
# Check NodeSource docs for the latest recommended version if needed
curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Install Nginx
sudo apt install -y nginx

# Verify installations (optional)
node -v
npm -v
git --version
nginx -v




# Navigate to a suitable directory
mkdir CloudCode
cd CloudCode

# Clone the repository
git clone https://github.com/pgotthardtuno/SimpleSocialCloudGame.git .

npm install

npm run build

# Install Certbot and its Nginx plugin
sudo apt install -y certbot python3-certbot-nginx

# Obtain and install the certificate (follow the prompts)
# Replace 'your_domain.com' and 'www.your_domain.com' with your actual domain(s)
sudo certbot --nginx -d 18.118.205.217 -d 18.118.205.217

# Certbot will ask about redirecting HTTP to HTTPS - choose the redirect option (usually option 2).
# It will automatically modify your Nginx configuration for SSL.

# Set up automatic renewal (Certbot usually does this during installation)
sudo certbot renew --dry-run # Test the renewal process


sudo nano /etc/nginx/sites-available/your_domain_or_default     

    location / {
        # --- Proxy to your Node.js app (running HTTPS on port 3000) ---
        # Ensure this points to the correct port your Node app uses (3000 in this case)
        # Since Node is running HTTPS locally, use https://
        proxy_pass https://localhost:3000; 

        # --- Headers needed for the backend app ---
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme; # $scheme will be 'https'

        # --- WebSocket Support ---
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # --- Adjust timeouts if needed ---
        proxy_read_timeout 300s; 
        proxy_send_timeout 300s; 
    }
    
sudo systemctl restart nginx

# Install PM2 globally
sudo npm install pm2 -g


# Start your application using PM2
# Make sure the path to your entry file (dist/server/index.js) is correct
pm2 start dist/server/index.js --name social-cloud-game

# Check the status of your running applications
pm2 list

# (Optional) View logs
pm2 logs social-cloud-game

# (Optional) Set up PM2 to start automatically on server reboot
pm2 startup systemd
# Follow the instructions given by the command above (it will likely give you a 'sudo env ...' command to run)

# Save the current PM2 process list
pm2 save 