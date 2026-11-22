UPDATE streamkist.streams SET tracking_state='category_paused',is_live=false,snapshot=jsonb_build_object('peak_viewers',peak_viewers,'ended_at',123,'category_stopped',true) WHERE canonical;
