-- A day may hold more than one trading window.
--
-- Pizza House bakes pastries 08:00-12:00 and pizza 16:00-23:30 and is shut in
-- between. The old key allowed one row per day, so those four closed midday
-- hours were bookable and a customer could be sold a 13:00 pickup at a locked
-- door. Adding the opening time to the key lets a day hold as many windows as
-- it has services, while still refusing the same window twice.

DROP INDEX IF EXISTS "BusinessHour_restaurantId_dayOfWeek_key";

CREATE UNIQUE INDEX "BusinessHour_restaurantId_dayOfWeek_opensAt_key"
  ON "BusinessHour" ("restaurantId", "dayOfWeek", "opensAt");

CREATE INDEX "BusinessHour_restaurantId_dayOfWeek_idx"
  ON "BusinessHour" ("restaurantId", "dayOfWeek");
