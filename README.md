
# MEAMS Asset Management Backend Setup

## Prerequisites
- Python 3.8 or higher
- MongoDB Compass (running locally or MongoDB Atlas)
- Node.js (for your React frontend)

## Backend Setup Steps

### 1. Create Python Virtual Environment
```bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate
```

### 2. Install Dependencies
```bash
pip install -r requirements.txt
```

### 3. MongoDB Setup
- Make sure MongoDB Compass is running on `mongodb://localhost:27017`
- Or update the `MONGODB_URL` in `.env` file if using MongoDB Atlas
- The database `meams_asset_management` will be created automatically

### 4. Start the Backend Server
```bash
python main.py
```

Your backend will be running at: `http://localhost:8000`

### 5. Test the API
Visit `http://localhost:8000/health` to check if everything is working.

## Frontend Integration

### 1. Create the API Service Directory
In your React project, create the services directory if it doesn't exist:
```bash
mkdir src/services
```

### 2. Add the API Service File
Copy the `suppliesApi.js` content into `src/services/suppliesApi.js`

### 3. Update Your React Environment (Optional)
Create a `.env` file in your React project root:
```
REACT_APP_API_URL=http://localhost:8000
```

## API Endpoints

### Supplies Endpoints
- `GET /api/supplies` - Get all supplies
- `POST /api/supplies` - Add new supply
- `GET /api/supplies/{id}` - Get supply by ID
- `PUT /api/supplies/{id}` - Update supply
- `DELETE /api/supplies/{id}` - Delete supply
- `GET /api/supplies/category/{category}` - Get supplies by category
- `GET /api/supplies/search/{query}` - Search supplies

### Other Endpoints
- `GET /health` - Health check
- `GET /api/categories` - Get all categories

## Data Structure

Your supply data will be stored in MongoDB with this structure:
```json
{
  "_id": "ObjectId",
  "name": "Item Name",
  "description": "Item Description",
  "category": "Sanitary|Office Supply|Medical|Equipment|Maintenance",
  "quantity": 100,
  "unit_price": 25.50,
  "supplier": "Supplier Name",
  "location": "Storage Location",
  "status": "available|out_of_stock|discontinued",
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

## Testing the Integration

1. Start your Python backend (`python main.py`)
2. Start your React frontend (`npm start`)
3. Navigate to your supplies page
4. Try adding a new supply item
5. The item should appear in the list and be saved to MongoDB

## Troubleshooting

### Common Issues:

1. **Connection Error**: Make sure MongoDB is running
2. **CORS Error**: Check that your React app URL is in the CORS origins
3. **Port Conflict**: Change the port in `main.py` if 8000 is taken
4. **Import Error**: Make sure the `suppliesApi.js` file is in the correct location

### View Your Data in MongoDB Compass:
1. Open MongoDB Compass
2. Connect to `mongodb://localhost:27017`
3. Navigate to `meams_asset_management` database
4. View the `supplies` collection

## Development Tips

- The backend automatically creates the database and collection
- All API responses include success status and messages
- Error handling is built-in with descriptive error messages
- The frontend API service includes retry logic and error handling

# Full Capstone Project Setup Guide

## PREREQUISITES
- Git
- Node.js (v18+)
- Python (3.11+)
- MongoDB (Local or Atlas)
- npm/yarn

## 1. INSTALL GIT

### Windows:
1. Download from https://git-scm.com/downloads
2. Run installer with default options
3. Verify:
   git --version

### macOS/Linux:
# macOS
brew install git

# Linux (Debian/Ubuntu)
sudo apt-get install git

## 2. INSTALL NODE.JS & npm
1. Download LTS version from https://nodejs.org
2. Verify:
   node --version
   npm --version

## 3. INSTALL PYTHON

### Windows:
1. Download from https://www.python.org/downloads/
2. Check "Add Python to PATH" during install
3. Verify:
   python --version
   pip --version

### macOS/Linux:
# macOS
brew install python

# Linux
sudo apt-get install python3 python3-pip

## 4. SETUP MONGODB

### Option A: Local MongoDB
- Windows/macOS: Download from https://www.mongodb.com/try/download/community
- Linux:
  sudo apt-get install mongodb
  sudo systemctl start mongodb

### Option B: MongoDB Atlas
1. Sign up at https://www.mongodb.com/atlas/database
2. Create free cluster
3. Whitelist your IP address
4. Get connection string

## 5. PROJECT SETUP

1. Clone repository:
   git clone https://github.com/your-username/your-repo.git
   cd your-repo

2. Frontend (React):
   cd frontend
   npm install
   cp .env.example .env
   npm start

3. Python Backend:
   cd ../backend/python
   pip install -r requirements.txt
   cp .env.example .env
   flask run

4. Node.js Backend:
   cd ../node
   npm install
   cp .env.example .env
   node server.js

## 6. RUNNING THE PROJECT

Open three separate terminals:

1. React Frontend:
   cd frontend && npm start
   (Access at http://localhost:3000)

2. Python API:
   cd backend/python && flask run
   (Access at http://localhost:5000)

3. Node.js API:
   cd backend/node && node server.js
   (Access at http://localhost:3001)

## TROUBLESHOOTING

1. Port Conflicts:
   - Check .env files and change ports if needed

2. Missing Modules:
   - Re-run npm install or pip install

3. MongoDB Connection:
   - Verify MONGO_URI in all .env files
   - Check if MongoDB service is running

4. Python Path Issues:
   - Ensure Python is in system PATH
   - Consider using virtualenv

## PROJECT STRUCTURE

your-repo/
├── frontend/       # React app (port 3000)
├── backend/
│   ├── python/     # Flask API (port 5000)
│   └── node/       # Express API (port 3001)
└── database/       # MongoDB scripts/schemas

For assistance, contact your team or create a GitHub issue.

# Getting Started with Create React App

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in your browser.

The page will reload when you make changes.\
You may also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can't go back!**

If you aren't satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you're on your own.

You don't have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn't feel obligated to use this feature. However we understand that this tool wouldn't be useful if you couldn't customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).

### Code Splitting

This section has moved here: [https://facebook.github.io/create-react-app/docs/code-splitting](https://facebook.github.io/create-react-app/docs/code-splitting)

### Analyzing the Bundle Size

This section has moved here: [https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size](https://facebook.github.io/create-react-app/docs/analyzing-the-bundle-size)

### Making a Progressive Web App

This section has moved here: [https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app](https://facebook.github.io/create-react-app/docs/making-a-progressive-web-app)

### Advanced Configuration

This section has moved here: [https://facebook.github.io/create-react-app/docs/advanced-configuration](https://facebook.github.io/create-react-app/docs/advanced-configuration)

### Deployment

This section has moved here: [https://facebook.github.io/create-react-app/docs/deployment](https://facebook.github.io/create-react-app/docs/deployment)

### `npm run build` fails to minify

This section has moved here: [https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify](https://facebook.github.io/create-react-app/docs/troubleshooting#npm-run-build-fails-to-minify)

