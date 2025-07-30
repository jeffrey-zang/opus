# landing

This is Opus's landing page (tryop.us).

## Setup

### 1. Install Dependencies

```bash
npm install
# or
bun install
```

### 2. Environment Variables

Create a `.env.local` file in the root directory:

```env
DATABASE_URL="postgresql://username:password@localhost:5432/your_database"
```

### 3. Database Setup

1. **Create Database**: Set up a PostgreSQL database
2. **Run Migrations**: Generate and run database migrations

```bash
# Generate migration
npx drizzle-kit generate

# Run migration (if using drizzle-kit push)
npx drizzle-kit push
```

### 4. Development

```bash
npm run dev
# or
bun dev
```

## API Endpoints

### POST /api/waitlist

Add an email to the waitlist.

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Success Response (201):**

```json
{
  "success": true,
  "message": "Successfully added to waitlist",
  "data": {
    "email": "user@example.com",
    "id": "uuid-here"
  }
}
```
