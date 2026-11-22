SELECT set_config('application_name',$1,false), set_config('statement_timeout',$2,false), set_config('lock_timeout',$3,false), set_config('idle_in_transaction_session_timeout',$4,false)
