
INSERT INTO zc_private.donations(message_id,timestamp,type,is_public,url,is_subscription_payment,is_first_subscription_payment,kofi_transaction_id,tier_name,discord_userid) VALUES
('00000000-0000-4000-8000-000000000010',now()-interval '1 day','Subscription',true,'https://example.com',true,false,'00000000-0000-4000-8000-000000000110','Bronze',12345678901234567),
('00000000-0000-4000-8000-000000000011',now()-interval '1 day','Subscription',true,'https://example.com',true,false,'00000000-0000-4000-8000-000000000111','Silver',12345678901234567),
('00000000-0000-4000-8000-000000000012',now(),'Tip',true,'https://example.com',false,false,'00000000-0000-4000-8000-000000000112',null,12345678901234567),
('00000000-0000-4000-8000-000000000013',now(),'Subscription',false,'https://example.com',true,false,'00000000-0000-4000-8000-000000000113','Private',12345678901234567),
('00000000-0000-4000-8000-000000000014',now(),'Tip',false,'https://example.com',false,false,'00000000-0000-4000-8000-000000000114',null,22345678901234567),
('00000000-0000-4000-8000-000000000015',now(),'Tip',true,'https://example.com',false,false,'00000000-0000-4000-8000-000000000115',null,null),
('00000000-0000-4000-8000-000000000016',now()-interval '36 days','Subscription',true,'https://example.com',true,false,'00000000-0000-4000-8000-000000000116',null,32345678901234567);
