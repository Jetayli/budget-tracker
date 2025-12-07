# Marketing Budget Tracker

## Overview

A utility-focused web application for tracking marketing budgets and expenses across multiple projects. The application allows users to create projects with individual budgets and monitor expenses across different categories (Advertising, Social Media, Content, Events, Email Marketing, SEO, and Other). Built with a focus on clarity, efficiency, and data legibility, following Material Design principles adapted for financial data visualization.

The application provides real-time budget tracking with visual indicators (progress bars, currency displays) and supports full CRUD operations on both projects and expenses. The design emphasizes immediate data visibility and efficient data entry, making it ideal for marketing teams managing multiple campaign budgets.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript, using Vite as the build tool and development server

**UI Component System**: shadcn/ui component library built on Radix UI primitives
- Provides accessible, composable components following the "New York" style variant
- Uses Tailwind CSS for styling with custom CSS variables for theming
- Component aliases configured for clean imports (`@/components`, `@/lib`, `@/hooks`)

**State Management**: 
- TanStack Query (React Query) for server state management and data fetching
- React Hook Form with Zod validation for form state and validation
- Built-in React state for UI-specific concerns (selected project tracking)

**Routing**: Wouter for lightweight client-side routing

**Design System**:
- Custom color palette using HSL values with CSS variables for light/dark mode support
- Typography system using Inter/Roboto fonts via Google Fonts CDN
- Spacing based on Tailwind's utility classes (units of 2, 4, 6, 8)
- Responsive design with mobile-first approach (mobile breakpoint at 768px)

### Backend Architecture

**Server Framework**: Express.js running on Node.js

**API Design**: RESTful API with the following endpoints:

Project Endpoints:
- `GET /api/projects` - List all projects
- `GET /api/projects/:id` - Get single project
- `POST /api/projects` - Create new project
- `PATCH /api/projects/:id` - Update existing project
- `DELETE /api/projects/:id` - Delete project (also deletes associated expenses)

Expense Endpoints:
- `GET /api/expenses` - List all expenses (optionally filtered by projectId query param)
- `GET /api/expenses/:id` - Get single expense
- `POST /api/expenses` - Create new expense (requires projectId)
- `PUT /api/expenses/:id` - Update existing expense
- `DELETE /api/expenses/:id` - Delete expense

**Validation**: Zod schemas for request validation with `zod-validation-error` for friendly error messages

**Data Storage**: 
- In-memory storage implementation (`MemStorage`) for development
- Designed with an `IStorage` interface to allow swapping storage backends
- UUID-based identifiers for all entities

**Development Features**:
- Hot Module Replacement (HMR) via Vite in development
- Request logging middleware with timing information
- Raw body capture for webhook/payment processing capabilities
- Replit-specific development plugins (cartographer, dev banner, runtime error overlay)

### Data Storage Solutions

**Database ORM**: Drizzle ORM configured for PostgreSQL
- Schema definition in `shared/schema.ts` for type safety across frontend and backend
- Migration support via `drizzle-kit`
- Database URL configuration via environment variables

**Schema Design**:
- `projects` table: Stores project info with UUID primary key, name, and budgetAmount
- `expenses` table: Stores expense records with name, amount, category, projectId reference, and UUID primary key
- One-to-many relationship: Projects have many Expenses

**Type Safety**: 
- Shared TypeScript types generated from Drizzle schema
- Zod validation schemas derived from database schema using `drizzle-zod`
- Ensures consistency between client, server, and database

**Session Management**: Configured for `connect-pg-simple` (PostgreSQL-backed sessions)

### External Dependencies

**UI Component Libraries**:
- Radix UI: Accessible component primitives (dialogs, dropdowns, popovers, etc.)
- Lucide React: Icon system
- class-variance-authority: Component variant management
- Embla Carousel: Carousel functionality
- cmdk: Command palette interface
- date-fns: Date formatting and manipulation

**Development Tools**:
- TypeScript: Type safety across the stack
- ESBuild: Fast server bundling for production
- Vite: Frontend development server and build tool
- tsx: TypeScript execution for development

**Production Build**:
- Client: Vite builds to `dist/public`
- Server: ESBuild bundles with selective dependency bundling (allowlist approach to reduce syscalls)
- Single-process deployment serving both static assets and API

**Database & Session**:
- PostgreSQL: Primary database (configured via DATABASE_URL environment variable)
- pg: PostgreSQL client
- connect-pg-simple: PostgreSQL session store

**Styling**:
- Tailwind CSS: Utility-first CSS framework
- PostCSS: CSS processing with Autoprefixer
- Custom theme using CSS variables for colors

**Potential Future Integrations** (dependencies installed but not yet implemented):
- Authentication: Passport.js with local strategy, JWT support
- Email: Nodemailer
- Payments: Stripe
- AI: OpenAI, Google Generative AI
- File handling: Multer
- Data export: xlsx
- WebSockets: ws
