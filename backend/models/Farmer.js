const mongoose = require('mongoose');

const farmerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    gender: { type: String, enum: ['male', 'female', 'other'], default: null },
    dateOfBirth: { type: Date, default: null },
    mobileNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: [/^[0-9]{10}$/, 'Mobile number must be exactly 10 digits'],
    },
    pin: { type: String, select: false }, // hashed, optional extra auth
    preferredLanguage: {
      type: String,
      enum: ['en', 'ta', 'hi', 'te'],
      default: 'ta',
    },
    village: { type: String, trim: true },
    taluk: { type: String, trim: true },
    district: { type: String, trim: true },
    state: { type: String, trim: true, default: 'Tamil Nadu' },
    pincode: {
      type: String,
      trim: true,
      match: [/^[0-9]{6}$/, 'Pincode must be exactly 6 digits'],
      default: null,
    },

    // --- KYC, collected as the second registration step. Optional at the
    // schema level because a farmer's document is created right after the
    // mobile OTP step and filled in progressively as the wizard continues. ---
    aadharNumber: {
      type: String,
      trim: true,
      match: [/^[0-9]{12}$/, 'Aadhar number must be exactly 12 digits'],
      default: null,
    },
    aadharVerified: { type: Boolean, default: false },

    // The land itself may be in a different District/Taluk/Village than
    // where the farmer lives (residence, above) - asked again here rather
    // than assumed to be the same, since a farmer can own/lease/rent land
    // elsewhere.
    landDistrict: { type: String, trim: true, default: null },
    landTaluk: { type: String, trim: true, default: null },
    landVillage: { type: String, trim: true, default: null },
    pattaNumber: { type: String, trim: true, default: null },
    chittaNumber: { type: String, trim: true, default: null }, // also doubles as the Survey number, where used interchangeably
    // Whether the farmer owns the land or is farming it under a
    // lease/rental arrangement. A leased/rented tenure requires a supporting
    // document upload (see leaseDocumentPath) since the Patta itself won't
    // be in the farmer's name in that case.
    landTenure: { type: String, enum: ['owned', 'leased', 'rented'], default: 'owned' },
    // Relative path (served under /uploads) to the uploaded lease/rental
    // agreement (PDF or photo) - only present/required when landTenure is
    // 'leased' or 'rented'. NOTE: on a host with an ephemeral filesystem
    // (e.g. Render's default web service disk), this file will not survive
    // a redeploy/restart unless a persistent disk or external object
    // storage (S3, Cloudinary, etc.) is added - see the deployment notes.
    leaseDocumentPath: { type: String, default: null },
    policyAccepted: { type: Boolean, default: false },
    policyAcceptedAt: { type: Date, default: null },

    // --- Preferred procurement centres, chosen as the last registration
    // step. Pre-populated by the frontend with the farmer's district's
    // centres, then freely added to / removed from via search. First entry
    // is treated as the "default" centre wherever a single one is needed. ---
    preferredCentres: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Centre' }],

    // --- Bank details for DBT payment. Captured during the booking flow but
    // stored on the farmer profile so later bookings can prefill it; each
    // Booking also keeps its own snapshot (see Booking.bankSnapshot) since a
    // farmer could change banks between bookings. ---
    bankDetails: {
      accountHolderName: { type: String, trim: true, default: null },
      bankName: { type: String, trim: true, default: null },
      accountNumber: { type: String, trim: true, default: null },
      ifscCode: { type: String, trim: true, uppercase: true, default: null },
    },

    registeredAt: { type: String, trim: true }, // name of authorised registration point
    registeredVia: {
      type: String,
      enum: ['web', 'centre_staff', 'csc'],
      default: 'centre_staff',
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// True once a farmer has completed every step of the registration wizard
// (location, KYC + policy, at least one preferred centre). Used by the
// frontend right after login to resume the wizard at the correct step
// instead of dropping an incomplete profile straight into booking.
farmerSchema.virtual('registrationComplete').get(function registrationComplete() {
  const tenureDocumentOk = this.landTenure === 'owned' || Boolean(this.leaseDocumentPath);
  return Boolean(
    this.district &&
      this.taluk &&
      this.village &&
      this.pincode &&
      this.aadharVerified &&
      this.landDistrict &&
      this.landTaluk &&
      this.landVillage &&
      this.pattaNumber &&
      this.chittaNumber &&
      tenureDocumentOk &&
      this.policyAccepted &&
      this.preferredCentres &&
      this.preferredCentres.length > 0
  );
});

farmerSchema.set('toJSON', { virtuals: true });
farmerSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Farmer', farmerSchema);
