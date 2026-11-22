UPDATE streamkist.streams SET activation_pending=true WHERE id=$1 RETURNING {{message_columns}}
