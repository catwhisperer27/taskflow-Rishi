-- Seed data for TaskFlow
-- Password for ALL users: password123
-- bcrypt hash of "password123" at cost 12

INSERT INTO users (id, name, username, email, password) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Rishi Jarwal', 'rishijarwal', 'test@example.com',  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK9i'),
  ('00000000-0000-0000-0000-000000000002', 'Alice Chen',   'alicechen',   'alice@example.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK9i'),
  ('00000000-0000-0000-0000-000000000003', 'Bob Martinez', 'bobmartinez', 'bob@example.com',   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK9i'),
  ('00000000-0000-0000-0000-000000000004', 'Sara Johnson', 'sarajohnson', 'sara@example.com',  '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj4J/HS.iK9i')
ON CONFLICT DO NOTHING;

-- "Parameter Golf" demo project owned by Rishi, all 4 users are members
INSERT INTO projects (id, name, description, owner_id) VALUES
  ('00000000-0000-0000-0001-000000000001', 'Parameter Golf',
   'Train the best language model that fits in a 16MB artifact and trains in under 10 minutes on 8xH100s, evaluated by compression on the FineWeb validation set (tokenizer-agnostic, bits per byte).',
   '00000000-0000-0000-0000-000000000001')
ON CONFLICT DO NOTHING;

INSERT INTO project_members (project_id, user_id, role) VALUES
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', 'owner'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000002', 'member'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000003', 'member'),
  ('00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000004', 'member')
ON CONFLICT DO NOTHING;

INSERT INTO tasks (id, title, description, status, priority, project_id, assignee_id, due_date) VALUES
  ('00000000-0000-0000-0002-000000000001',
   'Baseline BPB benchmark',
   'Run the reference GPT-2 124M checkpoint on FineWeb val set to establish our baseline bits-per-byte score. Document GPU memory, throughput, and exact eval command.',
   'done', 'high', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000002', '2026-04-10'),

  ('00000000-0000-0000-0002-000000000002',
   'Implement int8 weight quantization',
   'Apply post-training int8 quantization to all linear layers. Target: keep BPB within 0.02 of fp32 baseline while cutting artifact size by ~50%. Use bitsandbytes or manual absmax.',
   'done', 'high', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000003', '2026-04-12'),

  ('00000000-0000-0000-0002-000000000003',
   'Participant Form',
   'Many researchers at OpenAI first distinguished themselves through elite competitions like IOI, Putnam, and ICPC. We also know compute is expensive, so OpenAI is sponsoring $1,000,000 in compute grants for participants.',
   'in_progress', 'medium', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000002', '2026-04-18'),

  ('00000000-0000-0000-0002-000000000004',
   'Request a Compute Grant',
   'We also know compute is expensive, so OpenAI is sponsoring $1,000,000 in compute grants for participants. Fill in the participant form and request resources via the OpenAI portal.',
   'done', 'medium', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001', '2026-04-23'),

  ('00000000-0000-0000-0002-000000000005',
   'Train micro-LLM under 16MB',
   'Design and train a tokenizer-agnostic micro-LLM that fits in 16MB serialized. Explore 4-bit weights, shared embeddings, and aggressive pruning to hit the size constraint without destroying BPB.',
   'todo', 'high', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000004', '2026-04-25'),

  ('00000000-0000-0000-0002-000000000006',
   'Setup training environment on RunPod',
   'Provision 8xH100 RunPod instance. Install CUDA 12.3, PyTorch nightly, flash-attention-2. Verify NVLink bandwidth and run a smoke-test forward pass before any real training.',
   'todo', 'medium', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000003', '2026-04-20')
ON CONFLICT DO NOTHING;

-- Seed some example chat messages
INSERT INTO comments (id, project_id, user_id, body, created_at) VALUES
  ('00000000-0000-0000-0003-000000000001', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001',
   '@alice when will you be done with the participant form task?', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0003-000000000002', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000002',
   '@rishi should be done by tomorrow EOD. Also @bob can you check the int8 quantization results?', NOW() - INTERVAL '1 hour 45 minutes'),
  ('00000000-0000-0000-0003-000000000003', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000003',
   'Done! BPB dropped by only 0.015 from baseline. Ill push the results to the shared folder.', NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0003-000000000004', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000004',
   '@rishi I need access to the RunPod credits before I can start the training env setup', NOW() - INTERVAL '30 minutes'),
  ('00000000-0000-0000-0003-000000000005', '00000000-0000-0000-0001-000000000001', '00000000-0000-0000-0000-000000000001',
   '@sara sending you the API key now. Lets aim to have the 16MB model training by end of week!', NOW() - INTERVAL '15 minutes')
ON CONFLICT DO NOTHING;
