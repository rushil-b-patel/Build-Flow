# Build Flow 🚀

Build Flow is a lightweight, Vercel-style deployment pipeline. If you have a static frontend app (like a React or Vite project) on GitHub, Build Flow can automatically build it and put it on the internet for you!

## What does it do?

1. You paste a GitHub repository link into our website.
2. You click **Deploy**.
3. You watch the live build logs as our system sets up your app.
4. You get a live URL to share your website with the world!

## How it works (The Architecture)

Think of Build Flow as a factory with different departments working together. It is broken down into four main parts (microservices):

1. **Frontend (`frontend/`)**: This is the dashboard website you see. It's built with React and Vite. You use this to submit your GitHub links and track your deployment status.
2. **Upload Service (`upload/`)**: The "receptionist." When you submit a link, this service downloads your code, saves it to cloud storage (like AWS S3), and puts a "build this app" ticket into a to-do list.
3. **Deploy Worker (`deploy/`)**: The "construction worker." This service constantly watches the to-do list. When it sees your ticket, it downloads your code, installs the dependencies (`npm install`), builds the final website (`npm run build`), and saves the finished product back to cloud storage.
4. **Request Service (`request/`)**: The "delivery driver." When someone visits your newly generated website link, this service grabs your finished website files from storage and sends them to the visitor's browser.

### The Databases
- **Redis**: Acts as our fast "to-do list" (queue) for the Deploy Worker, and stores the live streaming logs you see while your app is building.
- **Postgres**: Our main database that saves user information, project details, and the history of deployments.

## How to run it on your own computer

The easiest way to run the entire factory on your computer is using **Docker**.

### 1. Set up Environment Variables
Create `.env` files in each service folder (`upload/.env`, `deploy/.env`, `request/.env`) with your cloud storage credentials:
```bash
ACCESS_KEY_ID=your_key
SECRET_ACCESS_KEY=your_secret
END_POINT=your_endpoint
BUCKET_NAME=your_bucket
```

For the `frontend/.env`, tell it where the local services are running:
```bash
VITE_BASE_URL=http://localhost:3000
VITE_DEPLOY_URL=localhost:3001
```

### 2. Start the Backend Services
Open your terminal in the root of the project and run:
```bash
docker compose up --build
```
This single command spins up Redis, Postgres, the Upload Service, the Deploy Worker, and the Request Service all at once!

### 3. Start the Frontend
In a new terminal window, go to the frontend folder and start the React app:
```bash
cd frontend
npm install
npm run dev
```

Now, open your browser and go to the local frontend link. You're ready to deploy!
