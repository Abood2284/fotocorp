ALTER TABLE "customer_access_inquiries" DROP CONSTRAINT IF EXISTS "customer_access_inquiries_status_check";
ALTER TABLE "customer_access_inquiries" ADD CONSTRAINT "customer_access_inquiries_status_check" CHECK ("status" in ('PENDING','IN_REVIEW','CLOSED','ACCESS_GRANTED'));
