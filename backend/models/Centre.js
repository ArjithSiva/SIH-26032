const mongoose = require('mongoose');

const centreSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    // Short, unique code generated once at creation time (see
    // utils/centrePrefix.js), e.g. "TNJ-014". Forms the first segment of
    // every token issued at this centre, so a token is traceable back to
    // its centre at a glance.
    codePrefix: { type: String, unique: true, sparse: true, trim: true, uppercase: true },
    state: { type: String, default: 'Tamil Nadu', trim: true },
    district: { type: String, required: true, trim: true }, // TNCSC "Region Name"
    taluk: { type: String, trim: true },
    village: { type: String, trim: true }, // TNCSC "Village Name" - the DPC's actual location
    address: { type: String, trim: true },
    location: {
      latitude: Number,
      longitude: Number,
    },

    // Daily booking-window hours used to generate slots - unrelated to the
    // season dates below. A centre only accepts bookings while it has an
    // active procurement season (see isCurrentlyInSeason on Slot logic).
    openingTime: { type: String, default: '08:00' }, // 24h "HH:mm"
    closingTime: { type: String, default: '17:00' },
    slotDurationMinutes: { type: Number, default: 60 },
    capacityPerSlot: { type: Number, default: 20 },
    // Which weekdays the centre accepts bookings on, set by the centre
    // itself from its own settings panel. Empty/absent = every day (kept
    // permissive so existing centres from before this field don't silently
    // stop appearing in slot generation).
    workingDays: {
      type: [String],
      enum: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
      default: ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'],
    },

    // Bounds set by the Master/State admin that a centre's own officer
    // cannot exceed when editing their settings (openingTime/closingTime/
    // slotDurationMinutes/capacityPerSlot above). Enforced in
    // centreController.updateCentre. Only admins can change policyLimits
    // itself.
    policyLimits: {
      earliestOpeningTime: { type: String, default: '06:00' },
      latestClosingTime: { type: String, default: '20:00' },
      minSlotDurationMinutes: { type: Number, default: 30 },
      maxSlotDurationMinutes: { type: Number, default: 120 },
      minCapacityPerSlot: { type: Number, default: 5 },
      maxCapacityPerSlot: { type: Number, default: 100 },
    },

    // Procurement-season window, e.g. TNCSC's "DPC Opening/Closing Date" for
    // the current KMS (Kharif Marketing Season). seasonClosingDate is null
    // while the centre is still open for the season ("-" in the source data).
    seasonOpeningDate: { type: Date, default: null },
    seasonClosingDate: { type: Date, default: null },
    // Mirrors TNCSC's DPC Status at last scrape. Centres are only sourced/kept
    // while Open; this is retained so a re-scrape can detect a centre that
    // has since closed without needing to delete it immediately.
    dpcStatus: { type: String, enum: ['Open', 'Closed'], default: 'Open' },
    sourceLastScrapedAt: { type: Date, default: null },

    // Crops this centre accepts, each with the max quantity it can take in
    // from one farmer (in whatever unit that crop is measured in - see
    // CropRate.unit, e.g. "bag") - set by the centre itself from its
    // settings panel. A virtual below still exposes `.supportedCrops` (just
    // the names) for any code that only needs the crop list, not the cap.
    crops: [
      {
        _id: false,
        name: { type: String, trim: true, required: true },
        maxQuantity: { type: Number, default: null }, // null = no cap set
      },
    ],
    officerName: { type: String, trim: true },
    officerMobile: { type: String, trim: true },

    // Each centre is its own login (picked by name/search at /officer/login)
    // rather than a shared password across every centre - set once at
    // creation (see utils/centrePrefix.js's sibling, ensureCentreDefaults,
    // for how existing centres from before this field get one) and
    // changeable afterwards by that centre's own officer or by admin.
    officerPasswordHash: { type: String, default: null, select: false },
    // True until the officer (or admin, on their behalf) sets their own
    // password for the first time - surfaced in the UI as a nudge to
    // change it off the initial default.
    mustChangeOfficerPassword: { type: Boolean, default: true },

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

centreSchema.index({ district: 1, taluk: 1 });

centreSchema.virtual('supportedCrops').get(function supportedCrops() {
  return (this.crops || []).map((c) => c.name);
});

centreSchema.set('toJSON', { virtuals: true });
centreSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Centre', centreSchema);
