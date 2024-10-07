Create .env.local file in root dir with the following strucutre:

MONGODB_URI=XXXXXXX
ADMIN_USERNAME=XXXXXXX
ADMIN_PASSWORD=XXXXXXX
ADMIN_EMAIL=XXXXXXX
JWT_SECRET=XXXXXXX

UPDATE_TIME=0830 # 8:30 AM When editing this, make sure to update the cron job in the vercel.json file


## Todo:

- Update daily meal update so users are not added twice
- Figure out a way to send emails without getting timeout