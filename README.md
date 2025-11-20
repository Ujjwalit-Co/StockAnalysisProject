# Stock Analysis Dashboard

A web application to track and analyze Indian stock prices with a real-time LTP (Last Traded Price) matrix.

## Features

*   **Stock Watchlist**: Add and remove stocks from your watchlist.
*   **Real-time Price Matrix**: View a matrix of the last traded prices for your watchlist stocks.
*   **Historical Data**: View historical price data for each stock.
*   **Data Export**: Export your stock data to CSV or Excel format.
*   **Automatic Data Updates**: A daily cron job fetches the latest stock data.
*   **Automatic Data Cleanup**: A daily cron job deletes historical data older than 30 days.

## Tech Stack

*   **Framework**: [Next.js](https://nextjs.org/)
*   **Language**: [TypeScript](https://www.typescriptlang.org/)
*   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
*   **UI Components**: [shadcn/ui](https://ui.shadcn.com/)
*   **ORM**: [Prisma](https://www.prisma.io/)
*   **Database**: [PostgreSQL](https://www.postgresql.org/)
*   **Deployment**: [Vercel](https://vercel.com/)

## Getting Started

### Prerequisites

*   Node.js (v20 or later)
*   npm
*   A PostgreSQL database

### Installation

1.  Clone the repository:
    ```bash
    git clone https://github.com/Ujjwalit-Co/StockAnalysisProject.git
    ```
2.  Navigate to the project directory:
    ```bash
    cd StockAnalysis
    ```
3.  Install the dependencies:
    ```bash
    npm install
    ```

### Environment Variables

Create a `.env.local` file in the root of your project and add the following environment variables:

```
DATABASE_URL="your-postgresql-connection-string"
```

You can get a free PostgreSQL database from providers like [Aiven](https://aiven.io/).

### Running the Application

1.  Apply the database schema:
    ```bash
    npx prisma migrate dev
    ```
2.  Run the development server:
    ```bash
    npm run dev
    ```
    The application will be available at `http://localhost:3000`.

## Database

The database schema is managed with Prisma. You can find the schema definition in `prisma/schema.prisma`.

To create a new migration, run:
```bash
npx prisma migrate dev --name <migration-name>
```

## Deployment

This project is optimized for deployment on [Vercel](https://vercel.com/).

1.  Push your code to a Git repository (e.g., on GitHub).
2.  Import your repository on Vercel.
3.  Set the `DATABASE_URL` environment variable in your Vercel project settings.
4.  Vercel will automatically deploy your application on every push to the main branch.

**Cron Job**: The project uses a Vercel Cron Job to update stock data daily. The configuration is in `vercel.json`.
