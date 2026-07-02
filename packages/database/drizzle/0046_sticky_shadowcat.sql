ALTER TABLE "record_statistic" RENAME COLUMN "duration" TO "time";--> statement-breakpoint
ALTER TABLE "record_statistic" RENAME COLUMN "distance_travelled" TO "distance";--> statement-breakpoint
ALTER TABLE "record_statistic" RENAME COLUMN "top_speed" TO "max_speed";--> statement-breakpoint
ALTER TABLE "record_statistic" RENAME COLUMN "soap_time" TO "time_soap_wheels";--> statement-breakpoint
ALTER TABLE "record_statistic" RENAME COLUMN "offroad_time" TO "time_offroad_wheels";--> statement-breakpoint
ALTER TABLE "record_statistic" RENAME COLUMN "paraglider_time" TO "time_paraglider";--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_on_1_wheel" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_on_2_wheels" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_on_3_wheels" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_on_4_wheels" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_on_1_wheel" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_on_2_wheels" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_on_3_wheels" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_on_4_wheels" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_slipping" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_paraglider" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_offroad_wheels" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_soap_wheels" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_on_monorail" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "distance_parked" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_slipping" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_on_monorail" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "time_parked" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "average_velocity" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "max_velocity" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "average_angular_velocity" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "max_angular_velocity" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "average_gforce" real;--> statement-breakpoint
ALTER TABLE "record_statistic" ADD COLUMN "max_gforce" real;
