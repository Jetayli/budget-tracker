-- Connect to the budget_tracker database
\c budget_tracker;

-- Create UUID extension for generating UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create budgets table
CREATE TABLE IF NOT EXISTS budgets (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL DEFAULT 'Marketing Budget',
    total_budget REAL NOT NULL,
    user_id TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    allocated_budget REAL NOT NULL,
    budget_id VARCHAR(36) NOT NULL,
    FOREIGN KEY (budget_id) REFERENCES budgets(id) ON DELETE CASCADE
);

-- Create subcategories table
CREATE TABLE IF NOT EXISTS subcategories (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    allocated_budget REAL NOT NULL,
    category_id VARCHAR(36) NOT NULL,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

-- Create spend_entries table
CREATE TABLE IF NOT EXISTS spend_entries (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount REAL NOT NULL,
    description TEXT NOT NULL,
    note TEXT,
    date TEXT NOT NULL,
    start_date TEXT,
    end_date TEXT,
    category_id VARCHAR(36) NOT NULL,
    subcategory_id VARCHAR(36),
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE,
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE CASCADE
);

-- Create tasks table
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(36) PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'todo',
    priority TEXT NOT NULL DEFAULT 'medium',
    deadline DATE,
    project_id VARCHAR(36) NOT NULL,
    category_id VARCHAR(36),
    subcategory_id VARCHAR(36),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_id) REFERENCES budgets(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL,
    FOREIGN KEY (subcategory_id) REFERENCES subcategories(id) ON DELETE SET NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_budget_id ON categories(budget_id);
CREATE INDEX IF NOT EXISTS idx_subcategories_category_id ON subcategories(category_id);
CREATE INDEX IF NOT EXISTS idx_spend_entries_category_id ON spend_entries(category_id);
CREATE INDEX IF NOT EXISTS idx_spend_entries_subcategory_id ON spend_entries(subcategory_id);
CREATE INDEX IF NOT EXISTS idx_spend_entries_date ON spend_entries(date);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_tasks_subcategory_id ON tasks(subcategory_id);

-- Insert sample data
-- Note: In production, user_id will be the Supabase Auth user ID
-- This sample uses a placeholder UUID for demonstration purposes
INSERT INTO budgets (id, name, total_budget, user_id) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Q1 Marketing Campaign', 6000.00, 'demo-user-00000000-0000-0000-0000-000000000000');

INSERT INTO categories (id, name, allocated_budget, budget_id) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Social Media', 2000.00, '550e8400-e29b-41d4-a716-446655440000'),
('550e8400-e29b-41d4-a716-446655440002', 'Google Ads', 1500.00, '550e8400-e29b-41d4-a716-446655440000'),
('550e8400-e29b-41d4-a716-446655440003', 'Content Marketing', 1000.00, '550e8400-e29b-41d4-a716-446655440000'),
('550e8400-e29b-41d4-a716-446655440004', 'Email Marketing', 800.00, '550e8400-e29b-41d4-a716-446655440000'),
('550e8400-e29b-41d4-a716-446655440005', 'SEO', 700.00, '550e8400-e29b-41d4-a716-446655440000');

-- Social Media subcategories
INSERT INTO subcategories (id, name, allocated_budget, category_id) VALUES
('550e8400-e29b-41d4-a716-446655440101', 'Facebook', 500.00, '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440102', 'Instagram', 500.00, '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440103', 'Twitter/X', 500.00, '550e8400-e29b-41d4-a716-446655440001'),
('550e8400-e29b-41d4-a716-446655440104', 'LinkedIn', 500.00, '550e8400-e29b-41d4-a716-446655440001');

-- Google Ads subcategories
INSERT INTO subcategories (id, name, allocated_budget, category_id) VALUES
('550e8400-e29b-41d4-a716-446655440201', 'Search Ads', 750.00, '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440202', 'Display Ads', 500.00, '550e8400-e29b-41d4-a716-446655440002'),
('550e8400-e29b-41d4-a716-446655440203', 'YouTube Ads', 250.00, '550e8400-e29b-41d4-a716-446655440002');

-- Content Marketing subcategories
INSERT INTO subcategories (id, name, allocated_budget, category_id) VALUES
('550e8400-e29b-41d4-a716-446655440301', 'Blog Posts', 400.00, '550e8400-e29b-41d4-a716-446655440003'),
('550e8400-e29b-41d4-a716-446655440302', 'Videos', 300.00, '550e8400-e29b-41d4-a716-446655440003'),
('550e8400-e29b-41d4-a716-446655440303', 'Infographics', 300.00, '550e8400-e29b-41d4-a716-446655440003');

-- Email Marketing subcategories
INSERT INTO subcategories (id, name, allocated_budget, category_id) VALUES
('550e8400-e29b-41d4-a716-446655440401', 'Newsletter Campaigns', 400.00, '550e8400-e29b-41d4-a716-446655440004'),
('550e8400-e29b-41d4-a716-446655440402', 'Email Automation', 400.00, '550e8400-e29b-41d4-a716-446655440004');

-- SEO subcategories
INSERT INTO subcategories (id, name, allocated_budget, category_id) VALUES
('550e8400-e29b-41d4-a716-446655440501', 'On-Page SEO', 350.00, '550e8400-e29b-41d4-a716-446655440005'),
('550e8400-e29b-41d4-a716-446655440502', 'Technical SEO', 350.00, '550e8400-e29b-41d4-a716-446655440005');

-- Sample spend entries
INSERT INTO spend_entries (id, amount, description, date, category_id, subcategory_id) VALUES
('550e8400-e29b-41d4-a716-446655460001', 150.00, 'Facebook Ad Campaign - Week 1', '2024-01-15', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440101'),
('550e8400-e29b-41d4-a716-446655460002', 200.00, 'Instagram Influencer Partnership', '2024-01-18', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440102'),
('550e8400-e29b-41d4-a716-446655460003', 300.00, 'Google Search Ads - January', '2024-01-20', '550e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440201'),
('550e8400-e29b-41d4-a716-446655460004', 250.00, 'Blog Content Creation', '2024-01-22', '550e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440301'),
('550e8400-e29b-41d4-a716-446655460005', 180.00, 'Email Newsletter Campaign', '2024-01-25', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440401');

-- Sample tasks
INSERT INTO tasks (id, title, description, status, priority, deadline, project_id, category_id, subcategory_id) VALUES
('550e8400-e29b-41d4-a716-446655470001', 'Plan Q2 Budget', 'Review performance and prepare next quarter allocations.', 'in_progress', 'high', '2024-02-15', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440101'),
('550e8400-e29b-41d4-a716-446655470002', 'Launch Instagram Giveaway', 'Coordinate assets with creative team.', 'todo', 'medium', '2024-03-01', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440102'),
('550e8400-e29b-41d4-a716-446655470003', 'Finalize Email Copy', 'Approve translations and schedule send.', 'done', 'low', '2024-01-28', '550e8400-e29b-41d4-a716-446655440000', '550e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440401');
