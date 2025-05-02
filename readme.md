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
    
    sudo apt install nginx -y
    
    sudo systemctl status nginx
    
    sudo mkdir -p /etc/ssl/private /etc/ssl/certs
    
        sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
     -keyout /etc/ssl/private/nginx-selfsigned.key \
     -out /etc/ssl/certs/nginx-selfsigned.crt

    sudo openssl dhparam -out /etc/ssl/certs/dhparam.pem 2048 # Or 4096 for stronger security
    
    
    sudo chmod 600 /etc/ssl/private/nginx-selfsigned.key
    sudo chmod 644 /etc/ssl/certs/nginx-selfsigned.crt
    sudo chmod 644 /etc/ssl/certs/dhparam.pem
    
    cd ~
    git clone https://github.com/pgotthardtuno/SimpleSocialCloudGame.git
    cd SimpleSocialCloudGame
    
    sudo cp nginx.conf /etc/nginx/sites-available/socialcloudgame
    
        sudo rm /etc/nginx/sites-enabled/default
    
        sudo ln -s /etc/nginx/sites-available/socialcloudgame /etc/nginx/sites-enabled/
    
        sudo nginx -t
    
    sudo systemctl reload nginx
    
    # If you added your user to the docker group and logged out/in:
    docker build -t socialcloudgame .
    # If not, use sudo:
    # sudo docker build -t socialcloudgame .
    
    # If you added your user to the docker group and logged out/in:
    docker run -d --restart always -p 127.0.0.1:3000:3000 --name socialcloudgame-app socialcloudgame
    # If not, use sudo:
    # sudo docker run -d --restart always -p 127.0.0.1:3000:3000 --name socialcloudgame-app socialcloudgame
    