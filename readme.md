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

# Navigate to a directory where you want to store the certs
# Using /etc/ssl/ is common, but requires sudo.
# For simplicity during setup, you could create them in your project root,
# but ensure they are NOT committed to Git and have proper permissions.
# Example: Creating in /etc/ssl/
sudo mkdir -p /etc/ssl/private
sudo mkdir -p /etc/ssl/certs

# Generate the private key and self-signed certificate
# This command creates both a key (server.key) and a certificate (server.crt)
# valid for 365 days. You'll be prompted for some info (Country, Org, etc.)
# For 'Common Name', you can use your EC2 public DNS or IP, or just 'localhost'
# if only accessing locally or via Nginx proxy.
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
-keyout /etc/ssl/private/nginx-selfsigned.key \
-out /etc/ssl/certs/nginx-selfsigned.crt

# (Optional but recommended) Create a strong Diffie-Hellman group
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048

# Adjust permissions (important if not running Nginx/Node as root)
sudo chmod 600 /etc/ssl/private/nginx-selfsigned.key
sudo chmod 644 /etc/ssl/certs/nginx-selfsigned.crt
sudo chmod 644 /etc/ssl/certs/dhparam.pem


sudo nano /etc/nginx/sites-available/your_domain_or_default     
# --- HTTPS Reverse Proxy Server Block (Port 443) ---
server {
listen 443 ssl http2;
listen [::]:443 ssl http2;

    # Use your EC2 public DNS, IP, or your registered domain if you have one pointed here
    server_name ec2-18-118-205-217.us-east-2.compute.amazonaws.com; # Or your domain

    # --- Use Self-Signed Certificates ---
    ssl_certificate         /etc/ssl/certs/nginx-selfsigned.crt; # Path to your generated cert
    ssl_certificate_key     /etc/ssl/private/nginx-selfsigned.key; # Path to your generated key
    # --- Add the DH Param ---
    ssl_dhparam             /etc/ssl/certs/dhparam.pem; # Path to your DH param file
    # --- End Self-Signed ---

    # --- Add recommended SSL settings (Keep these) ---
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:10m;
    ssl_session_tickets off;
    # ssl_stapling off; # OCSP Stapling doesn't apply to self-signed certs
    # ssl_stapling_verify off;
    # --- End recommended SSL settings ---

    # --- Logging (Optional but helpful) ---
    # access_log /var/log/nginx/socialgame_https.access.log;
    # error_log /var/log/nginx/socialgame_https.error.log;

    location / {
        # --- Proxy to your Node.js app (running HTTPS on port 3000) ---
        proxy_pass https://localhost:3000; # Keep as https

        # --- Headers needed for the backend app ---
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme; # $scheme will be 'https'

        # --- WebSocket Support ---
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}

# --- HTTP (Port 80) to HTTPS (Port 443) Redirect Block ---
server {
listen 80 default_server;
listen [::]:80 default_server;

    server_name ec2-18-118-205-217.us-east-2.compute.amazonaws.com; # Or your domain

    # --- Redirect all HTTP traffic to HTTPS ---
    location / {
        # Use 302 for temporary redirect during testing, change to 301 for permanent
        return 302 https://$host$request_uri;
    }
}
    
    sudo systemctl restart nginx

# Install PM2 globally
sudo npm install pm2 -g

# Navigate back to your project directory if you left it
cd ~/SocialCloudGame # Or /var/www/SocialCloudGame

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