const mongoose = require('mongoose');

const {Schema} = mongoose;

// ---------------------------------------------------
// Accessory
// ---------------------------------------------------
const accessorySchema = new Schema({
  filename: {type: String},
  material: {type: String},
  type: {type: String},
  uuid: {type: String, required: true},
  size: {type: Number},
});

// ---------------------------------------------------
// Installed Accessory
// ---------------------------------------------------
const installedAccessorySchema = new Schema({
  installedBy: {type: String, ref: 'User', required: false},
  updatedBy: {type: String, ref: 'User', required: false},
  dateInstalled: {type: Date, default: () => new Date()},
  dateChanged: {type: Date, default: () => new Date()},
  accessory: {type: accessorySchema},
});

// ---------------------------------------------------
// Main Base Model: Vehicle
// ---------------------------------------------------
const vehicleSchemaOptions = {
  discriminatorKey: 'vehicleType', // The discriminator key
  timestamps: true,
};

const vehicleSchema = new Schema(
  {
    name: {type: String, required: true},
    brand: {type: String, required: true},
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    serviceLogs: {
      type: [Schema.Types.ObjectId],
      ref: 'ServiceLog',
      index: true,
      default: () => [],
    },
    accessories: {type: [installedAccessorySchema]},
    isScrapped: {type: Schema.Types.Boolean, required: true, default: false, index: true},
  },
  vehicleSchemaOptions,
);

// Initialize the base model
const Vehicle = mongoose.model('Vehicle', vehicleSchema);

// ---------------------------------------------------
// Sub-documents for Car: Inspections
// ---------------------------------------------------
const inspectionHistorySchema = new Schema({
  inspector: {type: String, ref: 'User'},
  date: {type: Date, required: true},
  approved: {type: Boolean, required: true},
});

const safetyInspectionSchema = new Schema({
  inspectionStandardId: {type: Schema.Types.ObjectId, ref: 'Standard'},
  approvalHistory: {type: [inspectionHistorySchema]},
  comments: {type: [Schema.Types.Mixed]},
  diagnosticResults: {type: Schema.Types.Mixed},
});

// ---------------------------------------------------
// Discriminator Model: Car
// ---------------------------------------------------
const carSchema = new Schema({
  previousVehicleId: {type: Schema.Types.ObjectId, ref: 'Vehicle'},
  licensePlate: {type: String, required: false},
  priceInCents: {type: Number, required: false},
  status: {
    type: String,
    required: true,
    default: 'Draft',
    enum: ['Draft', 'InProduction', 'Delivered', 'Maintenance'],
  },
  features: {
    type: [String],
    default: () => [],
  },
  inspections: {type: [safetyInspectionSchema]},
  contactPersons: {
    type: [Schema.Types.ObjectId],
    ref: 'ContactPerson',
  },
  warrantyInfo: {
    type: Schema.Types.Mixed,
    default: () => ({
      engine: false,
      tires: false,
      electronics: false,
    }),
  },
});

// Create the discriminator using the base Vehicle model
const Car = Vehicle.discriminator('Car', carSchema);

module.exports = {
  Vehicle,
  Car,
};
