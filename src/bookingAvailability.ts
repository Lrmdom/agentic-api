// bookingAvailability.ts

// Import necessary types from the BigQuery client library
import { BigQuery, Job, type QueryOptions } from "@google-cloud/bigquery";

// --- Configuration Constants ---
// IMPORTANT: Replace these with your actual BigQuery project, dataset, and table details.
// The location should match your BigQuery dataset's region.
const PROJECT_ID: string = "avid-infinity-370500";
const DATASET_ID: string = "events_data_dataset";
const TABLE_ID: string = "events-data-table";
// @ts-ignore
const BQ_LOCATION: string = process.env.GOOGLE_BIGQUERY_LOCATION; // e.g., 'US', 'EU', 'europe-west1'

// Define constants for reservation states based on your BigQuery data
// Adjust these values if they map to different strings in your 'status' or 'payment_status' columns
const RESERVATION_STATES = {
  APPROVED: "approved", // Changed key to reflect usage in query params
  PAID: "paid", // Changed key to reflect usage in query params
};

// --- Type Definitions ---

// A minimal interface for the BigQuery client to type check the passed instance
interface BigQueryClient {
  createQueryJob(options: QueryOptions): Promise<[Job]>;
  // You might add other methods here if you use them, e.g., 'query(sql: string): Promise<[any[]]>'
}

// Type for the rows returned by _getUniqueModelsAndLocationsForSku
interface ModelLocationPair {
  vehicleModel: string;
  store_location: string;
  vehicle_registration_number?: string; // Add this if it's returned
}

// Type for rows returned by _checkSpecificBookingConflict (existing bookings)
interface ExistingBookingRow {
  start_Date: string; // Will now contain 'YYYY-MM-DDTHH:MM' from BigQuery
  end_Date: string; // Will now contain 'YYYY-MM-DDTHH:MM' from BigQuery
  booking_id: string;
}

// NEW: Type for the result of _checkSpecificBookingConflict
interface ConflictCheckResult {
  isConflict: boolean;
  conflictingDate?: string; // The first date that causes a conflict (YYYY-MM-DD)
}

// Type for the final result of checkSkuAvailabilityDetailed
export interface DetailedAvailabilityResult {
  vehicleModel: string | null;
  storeLocation: string | null;
  isAvailable: boolean;
  conflictDetails?: string | null; // Optional conflict message
  conflictingDate?: string | null; // NEW: Added to store the first conflicting date
  registration?: string | null; // Optional registration number
}

// --- Internal Helper Functions (not directly exported) ---

/**
 * Helper: Normalizes a date string (which can be 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM')
 * to a Date object set to the beginning of that specific day in **UTC**.
 * This is crucial for consistent date-only comparisons, avoiding local timezone issues.
 * @param {string} dateString - The date string (e.g., 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM').
 * @returns {Date} - A Date object representing the beginning of that day in UTC.
 */
function normalizeDateToUTCStartOfDay(dateString: string): Date {
  const date = new Date(dateString);

  if (isNaN(date.getTime())) {
    const datePart = dateString.substring(0, 10);
    const parsedDate = new Date(datePart);
    if (isNaN(parsedDate.getTime())) {
      throw new Error(
        `Failed to parse date string "${dateString}". Expected 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'.`,
      );
    }
    return new Date(
      Date.UTC(
        parsedDate.getFullYear(),
        parsedDate.getMonth(),
        parsedDate.getDate(),
      ),
    );
  }

  return new Date(
    Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()),
  );
}

/**
 * Helper: Fetches unique vehicleModel and store_location pairs for a given SKU code from BigQuery.
 * @param {string | undefined} skuCode - The SKU code to search for. Made optional.
 * @param {BigQueryClient} bigqueryClient - An initialized BigQuery client instance.
 * @returns {Promise<ModelLocationPair[]>} - An array of unique pairs.
 * @throws {Error} - If the BigQuery query fails.
 */
async function _getUniqueModelsAndLocationsForSku(
  skuCode: string | undefined,
  bigqueryClient: BigQuery,
): Promise<ModelLocationPair[]> {
  const now: Date = new Date();
  const today: string = now.toISOString().split("T")[0]; // Current date in 'YYYY-MM-DD' format

  const query: string = `
        SELECT DISTINCT vehicleModel, store_location, vehicle_registration_number
        FROM \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
        WHERE (@skuCode IS NULL OR @skuCode = '' OR sku_code = @skuCode) -- This line makes skuCode optional
          AND vehicleModel IS NOT NULL
          AND store_location IS NOT NULL
          AND (status = @statusApproved OR payment_status = @statusPaid) -- Only include these states
          AND end_Date >= @today -- Only include future/active bookings
    `;

  // @ts-ignore
  const options: QueryOptions = {
    // @ts-ignore
    query: query,
    location: BQ_LOCATION,
    params: {
      skuCode: skuCode === undefined ? null : skuCode, // Explicitly set to null if undefined
      statusApproved: RESERVATION_STATES.APPROVED,
      statusPaid: RESERVATION_STATES.PAID,
      today: today,
    },
    types: {
      // <--- ADDED THIS FOR NULL PARAMETER TYPE
      skuCode: "STRING", // Assuming sku_code in BigQuery is a STRING
    },
  };

  try {
    const [job] = await bigqueryClient.createQueryJob(options);
    const [rows] = (await job.getQueryResults()) as [ModelLocationPair[]];
    return rows;
  } catch (error) {
    console.error(
      `Error fetching unique models and locations for SKU "${skuCode || "ALL"}":`,
      error,
    );
    throw error;
  }
}

/**
 * Helper: Checks for booking conflicts for a specific item, vehicle model, store location, and date range.
 * This function contains the core date-checking logic.
 *
 * @param {string | undefined} skuCode - The SKU code of the item to check. Made optional.
 * @param {string} vehicleModel - The specific vehicle model (e.g., "Pcx 125 cc pt").
 * @param {string} storeLocation - The specific store location (e.g., "Faro").
 * @param {string} newBookingStartDate - The desired start date for the new booking (e.g., 'YYYY-MM-DD').
 * @param {string} newBookingEndDate - The desired end date for the new booking (e.g., 'YYYY-MM-DD').
 * @param {BigQueryClient} bigqueryClient - An initialized BigQuery client instance.
 * @returns {Promise<ConflictCheckResult>} - An object indicating if there's a conflict and the first conflicting date.
 * @throws {Error} - If a BigQuery query fails.
 */
async function _checkSpecificBookingConflict(
  skuCode: string | undefined, // Made optional here
  vehicleModel: string,
  storeLocation: string,
  newBookingStartDate: string,
  newBookingEndDate: string,
  bigqueryClient: BigQuery,
): Promise<ConflictCheckResult> {
  const today: string = new Date().toISOString().split("T")[0]; // Current date in 'YYYY-MM-DD' format

  // Normalize new desired booking dates to UTC start of day for consistent comparison.
  const newStart: Date = normalizeDateToUTCStartOfDay(newBookingStartDate);
  const newEnd: Date = normalizeDateToUTCStartOfDay(newBookingEndDate);

  // SQL query to fetch existing, relevant bookings for this specific combination
  const query: string = `
        SELECT
            start_Date,
            end_Date,
            vehicle_registration_number,
            id AS booking_id
        FROM
            \`${PROJECT_ID}.${DATASET_ID}.${TABLE_ID}\`
        WHERE
            (@skuCode IS NULL OR @skuCode = '' OR sku_code = @skuCode) -- Ensure optionality in this query too
            AND vehicleModel = @vehicleModel
            AND store_location = @storeLocation
            AND (status = @statusApproved OR payment_status = @statusPaid)
            AND end_Date >= @today -- Only consider existing bookings that are active or future
        ORDER BY
            start_Date DESC
    `;

  const options: QueryOptions = {
    // @ts-ignore
    query: query,
    location: BQ_LOCATION,
    params: {
      skuCode: skuCode === undefined ? null : skuCode, // Explicitly set to null if undefined
      vehicleModel: vehicleModel,
      storeLocation: storeLocation,
      statusApproved: RESERVATION_STATES.APPROVED,
      statusPaid: RESERVATION_STATES.PAID,
      today: today,
    },
    types: {
      // <--- ADDED THIS FOR NULL PARAMETER TYPE
      skuCode: "STRING", // Assuming sku_code in BigQuery is a STRING
    },
  };

  try {
    const [job] = await bigqueryClient.createQueryJob(options);
    const [rows] = (await job.getQueryResults()) as [ExistingBookingRow[]];

    if (rows.length === 0) {
      return { isConflict: false }; // No active bookings found, no conflict.
    }

    // --- Date Conflict Checking Logic (Day-by-Day Iteration) ---
    const tempNewDate = new Date(newStart.getTime());

    while (tempNewDate.getTime() < newEnd.getTime()) {
      const currentDayOfNewBooking = tempNewDate.getTime();
      const currentDayString = tempNewDate.toISOString().split("T")[0];

      for (const existingBooking of rows) {
        const existingStart: Date = normalizeDateToUTCStartOfDay(
          existingBooking.start_Date,
        );
        const existingEnd: Date = normalizeDateToUTCStartOfDay(
          existingBooking.end_Date,
        );

        if (
          currentDayOfNewBooking >= existingStart.getTime() &&
          currentDayOfNewBooking < existingEnd.getTime()
        ) {
          console.error(
            `Conflict found! Desired date (${currentDayString}) overlaps with existing booking (ID: ${existingBooking.booking_id}, SKU: ${skuCode || "N/A"}, Model: ${vehicleModel}, Location: ${storeLocation}, Dates: ${existingBooking.start_Date} to ${existingBooking.end_Date}).`,
          );
          return { isConflict: true, conflictingDate: currentDayString };
        }
      }
      tempNewDate.setDate(tempNewDate.getDate() + 1); // Move to the next day
    }

    return { isConflict: false }; // No conflicts found after checking all days.
  } catch (error) {
    console.error(
      `Error checking booking conflict for "${skuCode || "N/A"}" "${vehicleModel}" at "${storeLocation}":`,
      error,
    );
    throw error;
  }
}

// --- Main Exported Function ---

/**
 * Checks availability for a given SKU code across all its historically associated
 * vehicle models and store locations for a specified date range.
 *
 * @param {string | undefined} skuCode - The SKU code to check (e.g., 'scooter-125cc'). Made optional.
 * @param {string} newBookingStartDate - The desired start date for the new booking (e.g., 'YYYY-MM-DD').
 * @param {string} newBookingEndDate - The desired end date for the new booking (e.g., 'YYYY-MM-DD').
 * @param {BigQueryClient} bigqueryClient - An initialized BigQuery client instance.
 * @returns {Promise<DetailedAvailabilityResult[]>} - An array of objects, each indicating availability status for a specific model/location.
 * Returns an empty array if no historical models/locations are found for the SKU.
 * @throws {Error} - If any underlying BigQuery query fails or if invalid dates are provided.
 */
export async function checkSkuAvailabilityDetailed(
  skuCode: string | undefined, // Type changed to make it optional
  newBookingStartDate: string | undefined,
  newBookingEndDate: string | undefined,
  bigqueryClient: BigQuery,
): Promise<DetailedAvailabilityResult[]> {
  const results: DetailedAvailabilityResult[] = [];

  // Basic validation for dates
  if (!newBookingStartDate || !newBookingEndDate) {
    throw new Error(
      "Both newBookingStartDate and newBookingEndDate are required.",
    );
  }

  console.log(
    `[checkSkuAvailabilityDetailed] Received SKU: "${skuCode || "ALL"}" | Start Date: "${newBookingStartDate}" | End Date: "${newBookingEndDate}"`,
  );

  const newStartNormalized: Date =
    normalizeDateToUTCStartOfDay(newBookingStartDate);
  const newEndNormalized: Date =
    normalizeDateToUTCStartOfDay(newBookingEndDate);

  if (
    isNaN(newStartNormalized.getTime()) ||
    isNaN(newEndNormalized.getTime())
  ) {
    throw new Error(
      `Invalid date format provided for newBookingStartDate or newBookingEndDate. Expected 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'. Got start: "${newBookingStartDate}", end: "${newBookingEndDate}"`,
    );
  }

  if (newEndNormalized.getTime() <= newStartNormalized.getTime()) {
    throw new Error(
      "newBookingEndDate must be strictly after newBookingStartDate for a valid booking period.",
    );
  }

  try {
    const modelLocationPairs: ModelLocationPair[] =
      await _getUniqueModelsAndLocationsForSku(skuCode, bigqueryClient);

    if (modelLocationPairs.length === 0) {
      console.log(
        `No historical vehicle models or locations found for SKU: "${skuCode || "ALL"}". Cannot determine availability for specific combinations.`,
      );
      return [];
    }

    for (const pair of modelLocationPairs) {
      const {
        vehicleModel,
        store_location: storeLocation,
        vehicle_registration_number: registration,
      } = pair;

      const conflictResult: ConflictCheckResult =
        await _checkSpecificBookingConflict(
          skuCode, // skuCode is passed as `string | undefined`
          vehicleModel,
          storeLocation,
          newBookingStartDate,
          newBookingEndDate,
          bigqueryClient,
        );

      results.push({
        vehicleModel: vehicleModel,
        storeLocation: storeLocation,
        registration: registration || null,
        isAvailable: !conflictResult.isConflict,
        conflictDetails: conflictResult.isConflict
          ? "Conflict found for these dates."
          : null,
        conflictingDate: conflictResult.conflictingDate || null,
      });
    }

    return results;
  } catch (error) {
    console.error(
      "An error occurred during detailed SKU availability check:",
      error,
    );
    throw error;
  }
}
