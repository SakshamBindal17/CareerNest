/* This is our database "blueprint".
We will run this file ONCE to create our tables.
*/

/* Create the "universities" table.
This will store all the universities approved by the Super-Admin.
*/
CREATE TABLE universities (
    university_id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    admin_name VARCHAR(255) NOT NULL,
    admin_email VARCHAR(255) NOT NULL UNIQUE,
    admin_title VARCHAR(255),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

/* Create the "onboarding_requests" table.
This temporarily stores the admin's application and their OTP
before they are approved by the Super-Admin.
*/
CREATE TABLE onboarding_requests (
    request_id SERIAL PRIMARY KEY,
    college_name VARCHAR(255) NOT NULL,
    contact_name VARCHAR(255) NOT NULL,
    contact_email VARCHAR(255) NOT NULL UNIQUE,
    contact_role VARCHAR(255),

    otp VARCHAR(10),
    otp_expires_at TIMESTAMP WITH TIME ZONE,

    is_verified BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

/* Create the main "users" table.
This stores all users (Students, Faculty, Alumni, Admins).
*/
CREATE TABLE users (
    user_id SERIAL PRIMARY KEY,
    full_name VARCHAR(255) NOT NULL,

    -- We have two email fields. 
    -- official_email is for Students/Faculty.
    -- personal_email is for Alumni sign-up AND student recovery.
    official_email VARCHAR(255) UNIQUE,
    personal_email VARCHAR(255) UNIQUE,

    password_hash VARCHAR(255) NOT NULL, -- We store a hash, never the password

    -- Role and Status
    role VARCHAR(50) NOT NULL, -- 'Student', 'Faculty', 'Alumni', 'HOD', 'College Admin', 'Super Admin'
    status VARCHAR(50) NOT NULL, -- 'pending_email_verification', 'pending_admin_approval', 'active', 'suspended'

    -- University Links
    college_id INT, -- This will link to the 'universities' table
    department_id INT, -- This will link to a 'departments' table (which we'll create later)

    -- Profile-Specific Fields
    graduation_year VARCHAR(10), -- For Students and Alumni
    institute_roll_number VARCHAR(100), -- Alumni institute roll number
    verification_document_url VARCHAR(1024), -- For Alumni [cite: 202-203]
    is_verification_delegate BOOLEAN DEFAULT false, -- Faculty can be assigned by HOD

    -- OTP and Timestamps
    otp VARCHAR(10),
    otp_expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- This sets up the 'foreign key' to link users to their university
    CONSTRAINT fk_college
        FOREIGN KEY(college_id) 
        REFERENCES universities(university_id)
        ON DELETE SET NULL
);

/* Add a dummy college for testing the sign-up form
*/
INSERT INTO universities (name, admin_name, admin_email, admin_title, status)
VALUES (
    'Dummy College 1', 
    'Test Admin', 
    'test.admin@dummy.edu', 
    'Head Admin',
    'active'
)
ON CONFLICT (admin_email) DO NOTHING;

/* Create the "password_reset_tokens" table.
This stores a secure, one-time-use token for password resets.
*/
CREATE TABLE password_reset_tokens (
    token_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL,
    token TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

/* Create the "departments" table.
Each department is linked to a university.
*/
CREATE TABLE departments (
    department_id SERIAL PRIMARY KEY,
    college_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    hod_name VARCHAR(255),
    hod_email VARCHAR(255) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_college
        FOREIGN KEY(college_id) 
        REFERENCES universities(university_id)
        ON DELETE CASCADE,

    -- A university can't have two departments with the same name
    CONSTRAINT unique_dept_name_per_college
        UNIQUE(college_id, name)
);

/* Create the "college_domains" table.
This stores the list of valid email domains for each college
for Student/Faculty auto-verification [cite: 53-54].
*/
CREATE TABLE college_domains (
    domain_id SERIAL PRIMARY KEY,
    college_id INT NOT NULL,
    domain VARCHAR(255) NOT NULL,

    CONSTRAINT fk_college
        FOREIGN KEY(college_id) 
        REFERENCES universities(university_id)
        ON DELETE CASCADE,

    -- A university can't add the same domain twice
    CONSTRAINT unique_domain_per_college
        UNIQUE(college_id, domain)
);

/* Update the 'users' table.
We need to allow the password to be NULL, so a Super-Admin can
create a College Admin account before they have set a password.
*/
ALTER TABLE users
ALTER COLUMN password_hash DROP NOT NULL;

/* Add a UNIQUE constraint to the universities table
to prevent two universities from having the same name.
*/
ALTER TABLE universities
ADD CONSTRAINT unique_university_name UNIQUE (name);

/* Add a "dept_code" (Department ID) to the departments table
   and ensure it is unique within a college.
*/
ALTER TABLE departments
ADD COLUMN dept_code ID;

ALTER TABLE departments
ADD CONSTRAINT unique_dept_code_per_college
UNIQUE(college_id, dept_code);

CREATE TABLE profiles (
    profile_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL UNIQUE,
    headline VARCHAR(255),
    about TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

CREATE TABLE jobs (
    job_id SERIAL PRIMARY KEY,
    college_id INT NOT NULL,
    user_id INT NOT NULL, -- The user who posted the job

    title VARCHAR(255) NOT NULL,
    company_name VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    job_type VARCHAR(50), -- e.g., 'Full-Time', 'Internship'
    description TEXT NOT NULL,
    application_link_or_email VARCHAR(1024) NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_college
        FOREIGN KEY(college_id) 
        REFERENCES universities(university_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(user_id)
        ON DELETE SET NULL
);

/* --- JOBS TABLE FIX --- */
/* 1. Drop the old combined column */
ALTER TABLE jobs
DROP COLUMN application_link_or_email;

/* 2. Add two new, separate, optional columns */
ALTER TABLE jobs
ADD COLUMN application_link VARCHAR(1024),
ADD COLUMN application_email VARCHAR(255);


/* Create the "connections" table.
This tracks the relationship between two users.
*/
CREATE TABLE connections (
    connection_id SERIAL PRIMARY KEY,

    -- The user who sent the request
    sender_id INT NOT NULL,
    -- The user who received the request
    receiver_id INT NOT NULL,

    -- 'pending', 'accepted', 'rejected'
    status VARCHAR(50) NOT NULL DEFAULT 'pending',

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Foreign keys to the users table
    CONSTRAINT fk_sender
        FOREIGN KEY(sender_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_receiver
        FOREIGN KEY(receiver_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    -- A user can only send one request to another user
    CONSTRAINT unique_connection
        UNIQUE(sender_id, receiver_id)
);


CREATE TABLE messages (
    message_id SERIAL PRIMARY KEY,

    -- Link to the connection (the relationship)
    connection_id INT NOT NULL,
    -- Link to the user who sent it
    sender_id INT NOT NULL,

    body TEXT, -- The text of the message
    attachment_url VARCHAR(1024), -- For file uploads

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_connection
        FOREIGN KEY(connection_id) 
        REFERENCES connections(connection_id)
        ON DELETE CASCADE,

    CONSTRAINT fk_sender
        FOREIGN KEY(sender_id) 
        REFERENCES users(user_id)
        ON DELETE SET NULL
);

/* --- CHAT v2: Add Read Receipts --- */
ALTER TABLE messages
ADD COLUMN read_at TIMESTAMP WITH TIME ZONE;


/* --- POSTS & FEED TABLES --- */

/* 1. The main 'posts' table */
CREATE TABLE posts (
    post_id SERIAL PRIMARY KEY,
    college_id INT NOT NULL,
    user_id INT NOT NULL, -- The author

    body TEXT, -- The text content of the post
    attachment_url VARCHAR(1024), -- For images/PDFs [cite: 282-284]

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_college
        FOREIGN KEY(college_id) 
        REFERENCES universities(university_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE
);

/* 2. The 'post_comments' table */
CREATE TABLE post_comments (
    comment_id SERIAL PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL, -- The author of the comment
    body TEXT NOT NULL,

    -- For nested replies [cite: 314]
    parent_comment_id INT, 

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_post
        FOREIGN KEY(post_id) 
        REFERENCES posts(post_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_parent_comment
        FOREIGN KEY(parent_comment_id)
        REFERENCES post_comments(comment_id)
        ON DELETE CASCADE
);

/* 3. The 'post_reactions' table (for Likes, Celebrate, etc.) */
CREATE TABLE post_reactions (
    reaction_id SERIAL PRIMARY KEY,
    post_id INT NOT NULL,
    user_id INT NOT NULL,

    -- 'like', 'celebrate', 'support', 'insightful', 'funny' [cite: 302]
    reaction_type VARCHAR(50) NOT NULL DEFAULT 'like', 

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_post
        FOREIGN KEY(post_id) 
        REFERENCES posts(post_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_user
        FOREIGN KEY(user_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    -- A user can only have one reaction per post
    CONSTRAINT unique_reaction_per_post
        UNIQUE(post_id, user_id)
);

/* 4. The 'comment_likes' table */
CREATE TABLE comment_likes (
    like_id SERIAL PRIMARY KEY,
    comment_id INT NOT NULL,
    user_id INT NOT NULL,

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_comment
        FOREIGN KEY(comment_id)
        REFERENCES post_comments(comment_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_user
        FOREIGN KEY(user_id)
        REFERENCES users(user_id)
        ON DELETE CASCADE,

    -- A user can only like a comment once
    CONSTRAINT unique_like_per_comment
        UNIQUE(comment_id, user_id)
);


/* --- POSTS v3: Moderation Table --- */
CREATE TABLE reported_content (
    report_id SERIAL PRIMARY KEY,
    post_id INT,
    comment_id INT,

    reported_by_user_id INT NOT NULL, -- The user who filed the report
    college_id INT NOT NULL, -- To help admins filter

    reason TEXT,
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'resolved'

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_post
        FOREIGN KEY(post_id) 
        REFERENCES posts(post_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_comment
        FOREIGN KEY(comment_id)
        REFERENCES post_comments(comment_id)
        ON DELETE CASCADE,
    CONSTRAINT fk_reported_by
        FOREIGN KEY(reported_by_user_id) 
        REFERENCES users(user_id)
        ON DELETE CASCADE
);


/* --- POSTS v2: Multiple Media --- */

/* 1. Drop the old, simple attachment column from the posts table */
ALTER TABLE posts
DROP COLUMN attachment_url;

/* 2. Create a new table to store all media for each post */
CREATE TABLE post_media (
    media_id SERIAL PRIMARY KEY,
    post_id INT NOT NULL,

    -- This will be 'image' or 'document'
    media_type VARCHAR(50) NOT NULL,

    -- This is the URL from Cloudinary
    media_url VARCHAR(1024) NOT NULL, 

    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_post
        FOREIGN KEY(post_id) 
        REFERENCES posts(post_id)
        ON DELETE CASCADE
);


-- Add this to your db.sql and execute it
CREATE TABLE post_mentions (
    mention_id SERIAL PRIMARY KEY,
    post_id INT NOT NULL REFERENCES posts(post_id) ON DELETE CASCADE,
    comment_id INT REFERENCES post_comments(comment_id) ON DELETE CASCADE, -- Null if mention is in the post body
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, -- The user who was mentioned
    mentioned_by_user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE, -- The user who wrote the post/comment
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_mentions_post_id ON post_mentions(post_id);
CREATE INDEX idx_mentions_user_id ON post_mentions(user_id);

/* --- PROFILE PAGE: Experience and Education --- */

/* 1. The 'experience' table */
CREATE TABLE experience (
    experience_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    company VARCHAR(255) NOT NULL,
    location VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE, -- Null if currently working here
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

/* 2. The 'education' table */
CREATE TABLE education (
    education_id SERIAL PRIMARY KEY,
    user_id INT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    school VARCHAR(255) NOT NULL,
    degree VARCHAR(255),
    field_of_study VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

/* 3. Update 'profiles' table for cover and profile photos */
ALTER TABLE profiles
ADD COLUMN cover_photo_url VARCHAR(1024),
ADD COLUMN profile_icon_url VARCHAR(1024);

/* 4. Update 'users' table for secondary email verification */
ALTER TABLE users
ADD COLUMN secondary_email_verified BOOLEAN DEFAULT false;