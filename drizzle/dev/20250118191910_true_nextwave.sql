CREATE TABLE "source_videos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "source_videos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"signature" text NOT NULL,
	"frame_count" integer NOT NULL,
	"frame_rate" real NOT NULL,
	"orientation_degrees" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "source_videos_signature_unique" UNIQUE("signature")
);

CREATE TABLE "video_frame_labels" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "video_frame_labels_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"video_frame_id" integer,
	"label_type" text DEFAULT 'rectangle' NOT NULL,
	"label_data" json NOT NULL
);

CREATE TABLE "video_frames" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "video_frames_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"video_id" integer,
	"frame_index" integer NOT NULL
);

ALTER TABLE "video_frame_labels" ADD CONSTRAINT "video_frame_labels_video_frame_id_video_frames_id_fk" FOREIGN KEY ("video_frame_id") REFERENCES "public"."video_frames"("id") ON DELETE no action ON UPDATE no action;
ALTER TABLE "video_frames" ADD CONSTRAINT "video_frames_video_id_source_videos_id_fk" FOREIGN KEY ("video_id") REFERENCES "public"."source_videos"("id") ON DELETE no action ON UPDATE no action;