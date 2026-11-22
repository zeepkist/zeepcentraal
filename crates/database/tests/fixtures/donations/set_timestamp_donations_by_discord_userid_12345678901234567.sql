UPDATE zc_private.donations SET timestamp=now()+interval '1 day' WHERE discord_userid=12345678901234567 AND is_subscription_payment
