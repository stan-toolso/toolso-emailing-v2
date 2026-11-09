const postSynchroSQL = `
CREATE VIEW "SendingStrategiesResults" AS  SELECT "SendingStrategiesScheduleStats"."scheduleId",
    "Schedule"."scheduleDate" AS date,
    "SendingStrategiesScheduleStats"."strategyType",
    "SendingStrategiesScheduleStats"."strategyName",
    "SendingStrategiesScheduleStats".config,
    "SendingStrategiesScheduleStats".esp,
    "SendingStrategiesScheduleStats".type,
    ("SendingStrategiesScheduleStats".stats ->> 'request'::text)::double precision AS requests,
    (("SendingStrategiesScheduleStats".stats ->> 'unique_open'::text)::double precision) / (("SendingStrategiesScheduleStats".stats ->> 'request'::text)::double precision) AS "openRate",
    (("SendingStrategiesScheduleStats".stats ->> 'unique_click'::text)::double precision) / (("SendingStrategiesScheduleStats".stats ->> 'request'::text)::double precision) AS "clickRate",
    (("SendingStrategiesScheduleStats".stats ->> 'unsub'::text)::double precision) / (("SendingStrategiesScheduleStats".stats ->> 'request'::text)::double precision) AS "unsubRate",
    (("SendingStrategiesScheduleStats".stats ->> 'complaint'::text)::double precision) / (("SendingStrategiesScheduleStats".stats ->> 'request'::text)::double precision) AS "complaintRate",
    ("SendingStrategiesScheduleStats".stats ->> 'qualityScore'::text)::double precision AS "qualityScore"
   FROM "SendingStrategiesScheduleStats"
     JOIN "Schedule" ON "SendingStrategiesScheduleStats"."scheduleId" = "Schedule"."parentId" AND "Schedule"."scheduleDate"::date = "SendingStrategiesScheduleStats".date;
     GRANT SELECT on "SendingStrategiesResults" to "grafanareader";

     DROP VIEW IF EXISTS "ScheduleReport" ;
     CREATE VIEW "ScheduleReport"    AS  
     select "parentId" as "scheduleId", 
          "scheduleDate",
          name, 
          CAST (report->>'requests' AS INTEGER) as requests,
          CAST (report->>'no_requests' AS INTEGER) as no_requests ,
          CAST (report->>'minNewContentsForContact' AS INTEGER) as min_new_contents_for_contact,
          coalesce(CAST(report->'no_requests_reasons'->>'score_filtered' as INTEGER),0)  as no_requests_score_filtered,
          coalesce(CAST(report->'no_requests_reasons'->>'pression_marketing_filter' as INTEGER),0)  as pression_marketing_filter,
          coalesce(CAST(report->'no_requests_reasons'->>'no_message_id' as INTEGER),0)  as no_message_id     
     from "Schedule"
     where 
          report is not null
          and CAST (report->>'requests' AS INTEGER)>0
          and "parentId" is not null
     ;
     
     GRANT SELECT ON "ScheduleReport" to grafanareader;

     DROP VIEW   IF EXISTS "RouterComplaints"  ;
     CREATE VIEW "RouterComplaints" AS
     select CAST(date AS date) date,"MailRouter".type,SUM(complaint) as complaints,SUM(CAST (complaint as float))/SUM(request) as complaints_vs_requests, SUM(CAST (complaint as float))/SUM(NULLIF(unique_open,0)) as complaints_vs_opens from 
         "ContactEventStatsAggregate" 
           INNER JOIN "Sender" on "senderId"="Sender".id
           INNER JOIN "MailRouter" on "mailRouterId"="MailRouter".id
     where "aggregateType"='se' and request>0
     group by date,"MailRouter".type;
     GRANT SELECT ON "RouterComplaints" to grafanareader;

     DROP VIEW   IF EXISTS "RouterUnsubs"  ;
     CREATE VIEW "RouterUnsubs" AS
       select CAST(date as date) date,"MailRouter".type,SUM(unsub) as unsubs,SUM(CAST (unsub as float))/SUM(request) as unsubs_vs_requests, SUM(CAST (unsub as float))/SUM(NULLIF(unique_open,0)) asunsubs_vs_opens from 
           "ContactEventStatsAggregate" 
             INNER JOIN "Sender" on "senderId"="Sender".id
             INNER JOIN "MailRouter" on "mailRouterId"="MailRouter".id
       where "aggregateType"='se' and request>0
       group by date,"MailRouter".type;
     GRANT SELECT ON "RouterUnsubs" to grafanareader;

     DROP VIEW   IF EXISTS "ContactByStatus"  ;
     CREATE VIEW "ContactByStatus" AS
     select 
     CAST(date as date) date,
     CAST (stats->'contactByStatus'->>'workable' AS INTEGER) as workable,
     CAST (stats->'contactByStatus'->>'new' AS INTEGER) as new,
     CAST (stats->'contactByStatus'->>'archived' AS INTEGER) as archived,
    CAST (stats->'contactByStatus'->>'hard_bounce' AS INTEGER) as hard_bounce,
   CAST (stats->'contactByStatus'->>'unsub' AS INTEGER) as unsub,
   CAST (stats->'contactByStatus'->>'complaint' AS INTEGER) as complaint,
   CAST (stats->'contactByStatus'->>'blacklisted' AS INTEGER) as blacklisted
      from "ContactStats"; 
     GRANT SELECT ON "ContactByStatus" to grafanareader;


     CREATE INDEX IF NOT EXISTS trgm_idx_contact_email ON "Contact" USING gin (email gin_trgm_ops)  ;
CREATE INDEX IF NOT EXISTS trgm_idx_contact_firstname ON "Contact" USING gin (firstname gin_trgm_ops);
CREATE INDEX IF NOT EXISTS trgm_idx_contact_lastname ON "Contact" USING gin (lastname gin_trgm_ops);
`;
exports.postSynchroSQL = postSynchroSQL;
