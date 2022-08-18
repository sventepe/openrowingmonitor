
print "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs
sudo ln -s /mnt/c/Development/Projects/RuderQuest/openrowingmonitor/ /opt/openrowingmonit
or
cd $INSTALL_DIR
sudo apt-get install bluetooth bluez libbluetooth-dev libudev-dev
# # get project code from repository
# sudo git init -q
# # older versions of git would use 'master' instead of 'main' for the default branch
# sudo git checkout -q -b main
# sudo git config remote.origin.url $GIT_REMOTE
# sudo git config remote.origin.fetch +refs/heads/*:refs/remotes/origin/*
# # prevent altering line endings
# sudo git config core.autocrlf false
# sudo git fetch --force origin
# sudo git fetch --force --tags origin
# sudo git reset --hard origin/main
# add bin directory to the system path
echo "export PATH=\"\$PATH:/opt/openrowingmonitor/bin\"" >> ~/.bashrc
# otherwise node-gyp would fail while building the system dependencies
sudo npm config set user 0
#install python
sudo apt install wget build-essential libreadline-dev libncursesw5-dev libssl-dev libsqlite3-dev tk-dev libgdbm-dev libc6-dev libbz2-dev libffi-dev zlib1g-dev
wget https://www.python.org/ftp/python/3.9.7/Python-3.9.7.tgz
tar xzf Python-3.9.7.tgz
cd Python-3.9.7
./configure --enable-optimizations
make altinstall

print
print "Downloading and compiling Runtime dependencies..."
sudo npm ci
#sudo npm run build

print "Setting up Open Rowing Monitor as autostarting system service..."
#sudo cp install/openrowingmonitor.service /lib/systemd/system/
#sudo systemctl daemon-reload
#sudo systemctl enable openrowingmonitor
#sudo systemctl restart openrowingmonitor

cd $CURRENT_DIR

print
print "sudo systemctl status openrowingmonitor"
#sudo systemctl status openrowingmonitor
print
print "Installation of Open Rowing Monitor finished."
print "Open Rowing Monitor should now be up and running."
print "You can now adjust the configuration in $INSTALL_DIR/config/config.js either via ssh or via the network share"
print
print "Please reboot the device for all features and settings to take effect."
