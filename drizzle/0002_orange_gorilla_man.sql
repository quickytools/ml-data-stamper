ALTER TABLE "video_frame_labels" DROP CONSTRAINT "video_frame_labels_video_frame_id_video_frames_id_fk";
--> statement-breakpoint
ALTER TABLE "video_frames" DROP CONSTRAINT "video_frames_video_id_source_videos_id_fk";
--> statement-breakpoint
DROP INDEX "video_frame_idx";--> statement-breakpoint
ALTER TABLE "source_videos" ALTER COLUMN "size_bytes" SET DATA TYPE bigint;--> statement-breakpoint
ALTER TABLE "video_frame_labels" ALTER COLUMN "video_frame_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "video_frames" ALTER COLUMN "video_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "video_frame_labels" ADD COLUMN "modified_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "video_frame_labels" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "video_frame_labels" ADD CONSTRAINT "video_frame_labels_video_frame_id_video_frames_id_fk" FOREIGN KEY ("video_frame_id") REFERENCES "public"."video_frames"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "video_frames" ADD CONSTRAINT "video_frames_video_id_source_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."source_videos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_video_frame_label_video_frame" ON "video_frame_labels" USING btree ("video_frame_id");--> statement-breakpoint
CREATE INDEX "idx_video_frame_labels_deleted_at" ON "video_frame_labels" USING btree ("deleted_at");--> statement-breakpoint
ALTER TABLE "video_frames" ADD CONSTRAINT "unq_video_frame" UNIQUE("video_id","frame_index");--> statement-breakpoint
ALTER TABLE "source_videos" ADD CONSTRAINT "orientation_degrees_validity" CHECK ("source_videos"."orientation_degrees" IN (0, 90, 180, 270));