# Basic Ubuntu start    
    sudo apt update
    sudo apt upgrade -y
    sudo apt install git -y

# Add Docker's official GPG key:

    sudo apt-get update
    sudo apt-get install ca-certificates curl
    sudo install -m 0755 -d /etc/apt/keyrings
    sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
    sudo chmod a+r /etc/apt/keyrings/docker.asc

# Add the repository to Apt sources:

    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu \
      $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
      sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
    sudo apt-get update

    # Install Docker Engine, CLI, Containerd, and Compose plugin:
    sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
    
    sudo usermod -aG docker $USER



#NGINX

sudo apt-get update
sudo apt-get install nginx -y
sudo ufw allow 'Nginx Full' # Allows both HTTP and HTTPS
sudo ufw enable            # Enable the firewall if it's not already active
sudo ufw status            # Check the status (optional)
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
-keyout /etc/ssl/private/nginx-selfsigned.key \
-out /etc/ssl/certs/nginx-selfsigned.crt
sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048
sudo nano /etc/nginx/nginx.conf


#PASTE INTO FILE#

# /etc/nginx/nginx.conf OR /etc/nginx/sites-available/default

# --- Basic Settings (Adjust worker_processes if needed based on CPU cores) ---
user www-data;
worker_processes auto;
pid /run/nginx.pid;
include /etc/nginx/modules-enabled/*.conf;

events {
worker_connections 768;
# multi_accept on; # Optional: Accept multiple connections at once
}

http {
# --- Basic HTTP Settings ---
sendfile on;
tcp_nopush on;
tcp_nodelay on;
keepalive_timeout 65;
types_hash_max_size 2048;
server_tokens off; # Hide Nginx version

    include /etc/nginx/mime.types;
    default_type application/octet-stream;

    # --- SSL Settings (Global - can be overridden in server blocks) ---
    ssl_protocols TLSv1.2 TLSv1.3; # Modern protocols
    ssl_prefer_server_ciphers off; # Let client choose stronger ciphers if available

    # --- Logging Settings ---
    access_log /var/log/nginx/access.log;
    error_log /var/log/nginx/error.log;

    # --- Gzip Settings (Optional but recommended) ---
    gzip on;
    gzip_disable "msie6";
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_buffers 16 8k;
    gzip_http_version 1.1;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # --- Virtual Host Configs ---
    # include /etc/nginx/conf.d/*.conf; # Often used for multiple site configs
    # include /etc/nginx/sites-enabled/*; # Default on Debian/Ubuntu

    # --- HTTPS Reverse Proxy Server Block (Port 443) ---
    server {
        listen 443 ssl http2;
        listen [::]:443 ssl http2;

        # --- IMPORTANT: Your EC2 Public IP ---
        server_name 3.145.78.35; # Your IP address

        # --- Use Self-Signed Certificates ---
        ssl_certificate         /etc/ssl/certs/nginx-selfsigned.crt;
        ssl_certificate_key     /etc/ssl/private/nginx-selfsigned.key;
        ssl_dhparam             /etc/ssl/certs/dhparam.pem;
        # --- End Self-Signed ---

        # --- Add recommended SSL settings (Keep these) ---
        # Stronger cipher suite (check compatibility if needed)
        ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305:DHE-RSA-AES128-GCM-SHA256:DHE-RSA-AES256-GCM-SHA384;
        ssl_session_timeout 1d;
        ssl_session_cache shared:SSL:10m; # Cache SSL sessions
        ssl_session_tickets off; # More secure to disable session tickets
        # ssl_stapling on; # Requires resolver directive, improves performance if using real certs
        # ssl_stapling_verify on;
        add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always; # HSTS Header
        add_header X-Frame-Options DENY always;
        add_header X-Content-Type-Options nosniff always;
        # --- End recommended SSL settings ---

        # --- Logging (Optional but helpful) ---
        # access_log /var/log/nginx/socialgame_https.access.log;
        # error_log /var/log/nginx/socialgame_https.error.log;

        location / {
            # --- Proxy to your Node.js app (running HTTP on port 3000) ---
            proxy_pass http://127.0.0.1:3000; # Use 127.0.0.1 or localhost

            # --- Headers needed for the backend app ---
            proxy_set_header Host $host; # Pass original host header
            proxy_set_header X-Real-IP $remote_addr; # Pass real client IP
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; # Append client IP to list
            proxy_set_header X-Forwarded-Proto $scheme; # Pass original scheme (https)

            # --- WebSocket Support ---
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade; # Required for WebSocket upgrade
            proxy_set_header Connection "upgrade"; # Required for WebSocket upgrade

            # --- Timeouts (Increase if needed for long operations/uploads) ---
            proxy_connect_timeout 60s;
            proxy_send_timeout 300s; # Increased for potential longer WS connections
            proxy_read_timeout 300s; # Increased for potential longer WS connections
        }
    }

    # --- HTTP (Port 80) to HTTPS (Port 443) Redirect Block ---
    server {
        listen 80 default_server;
        listen [::]:80 default_server;

        # --- IMPORTANT: Your EC2 Public IP ---
        server_name 3.145.78.35; # Your IP address

        # --- Redirect all HTTP traffic to HTTPS ---
        location / {
            # Use 302 for temporary redirect during testing, change to 301 for permanent deployment
            return 302 https://$host$request_uri;
        }
    }
}


# END PASTE INTO FILE #

sudo systemctl reload nginx

# Get source code from GIT

mkdir SocialGame
cd SocialGame
git clone https://github.com/pgotthardtuno/SimpleSocialCloudGame.git
cd SimpleSocialCloudGame


# Build with docker

sudo docker build -t socialcloudgame .

# Deploy with docker

# Make sure to replace SERVER_HOST=0.0.0.0 with YOUR IP ADDRESS
# Make sure to replace JWT_SECRET=" " with whatever secret you want for encryption

sudo docker run \
-p 127.0.0.1:3000:3000 \
-e PORT=3000 \
-e JWT_SECRET="H&H@&@82dffe" \
-e SERVER_HOST=3.145.78.35 \
--name socialcloudgame-app-env \
socialcloudgame
    