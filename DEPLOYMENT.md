# Vercel Deployment Guide

## Environment Variables Required

Add these environment variables in Vercel Dashboard > Settings > Environment Variables:

### Backend Variables
- `MONGODB_URI` - MongoDB connection string (MongoDB Atlas)
- `JWT_SECRET` - Secret key for JWT token generation
- `BROWSERBASE_API_KEY` - Browserbase API key for web scraping
- `GEMINI_API_KEY` - Google Gemini AI API key for SEO analysis
- `NODE_ENV` - Set to `production`

### Frontend Variables
- `VITE_BACKEND_URL` - Set to `/api` for Vercel deployment

## Deployment Steps

1. **Push code to GitHub**
   ```bash
   git init
   git add .
   git commit -m "Ready for Vercel deployment"
   git push origin main
   ```

2. **Deploy to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Click "New Project"
   - Import your GitHub repository
   - Vercel will automatically detect the configuration

3. **Configure Environment Variables**
   - In Vercel project settings, add all environment variables listed above
   - Make sure to add them for both Production and Preview environments

4. **Deploy**
   - Click "Deploy"
   - Vercel will build and deploy your application

## Important Notes

- The backend runs as a Vercel serverless function
- MongoDB Atlas must allow connections from Vercel's IP ranges
- Browserbase and Gemini API keys must be valid
- Cron jobs are disabled in production (serverless environment)
- The frontend uses relative paths (`/api`) for backend calls

## Troubleshooting

If you encounter errors:
1. Check all environment variables are set correctly
2. Verify MongoDB Atlas allows connections from anywhere (0.0.0.0/0)
3. Check API keys are valid and have sufficient credits
4. Review Vercel deployment logs for specific errors
