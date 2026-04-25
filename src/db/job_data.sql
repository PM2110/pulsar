INSERT INTO jobs (
    queue_name,
    job_type,
    payload,
    priority,
    max_attempts,
    failure_mode,
    fail_probability
)
VALUES
(
    'notifications',
    'email_send',
    '{"to": "user@example.com", "body": "Hello, your account has been created successfully.", "subject": "Welcome!"}',
    1,
    3,
    'succeed',
    0.3
),
(
    'notifications',
    'email_send',
    '{"to": "user@example.com", "body": "Hello, your account has been created successfully.", "subject": "Welcome!"}',
    10,
    3,
    'fail',
    0.3
),
(
    'notifications',
    'email_send',
    '{"to": "user@example.com", "body": "Hello, your account has been created successfully.", "subject": "Welcome!"}',
    5,
    3,
    'probably_fail',
    0.9
),
(
    'notifications',
    'email_send',
    '{"to": "user@example.com", "body": "Hello, your account has been created successfully.", "subject": "Welcome!"}',
    7,
    3,
    'probably_fail',
    0.3
),
(
    'notifications',
    'email_send',
    '{"to": "user@example.com", "body": "Hello, your account has been created successfully.", "subject": "Welcome!"}',
    3,
    3,
    'probably_fail',
    0.3
);