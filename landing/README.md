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

## Testing

This project includes comprehensive tests for the waitlist API endpoint. The test suite covers all scenarios including success cases, validation errors, rate limiting, and database constraints.

Run the tests using one of the following commands:

```bash
# Run all tests
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

### Writing New Tests

To add new tests:

1. Create test files in the `__tests__/` directory
2. Use Jest's `describe` and `it` functions
3. Mock external dependencies (database, rate limiting)
4. Test both success and error scenarios
5. Verify response status codes and body content

Example test structure:

```typescript
describe("API Endpoint", () => {
  it("should handle valid requests", async () => {
    // Test implementation
  });

  it("should handle invalid requests", async () => {
    // Test implementation
  });
});
```

## Continuous Integration (CI/CD)

This project uses GitHub Actions for automated testing and quality assurance.

### GitHub Actions Workflows

Workflows are configured in the root `.github/workflows/` directory:

1. **Landing Tests** (`landing-tests.yml`) - **ACTIVE**

   - Runs only when `/landing` folder is modified
   - Executes unit tests with mocked dependencies
   - Generates coverage reports
   - Uploads coverage to Codecov

2. **Landing Integration Tests** (`landing-integration-tests.yml`) - **DISABLED**
   - Currently disabled (commented out)
   - Includes PostgreSQL database service
   - Runs database migrations
   - Executes integration tests
   - Enable when you need real database tests

### Workflow Triggers

- **Path-based**: Only runs when files in `/landing/**` are modified
- **Branches**: Runs on pushes to `main` and `develop` branches
- **Pull Request**: Runs on PRs targeting `main` and `develop` branches

### Coverage Reports

Test coverage reports are automatically generated and uploaded to Codecov, providing:

- Line coverage metrics
- Branch coverage analysis
- Coverage trends over time
- PR coverage comments

### Local Development

To run the same tests locally that run in CI:

```bash
# Unit tests (no database required)
npm test

# Tests with coverage
npm run test:coverage

# Database operations
npm run db:generate  # Generate migrations
npm run db:push      # Push schema changes
npm run db:migrate   # Run migrations
```
