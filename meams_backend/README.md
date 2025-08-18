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