## Changes

### [#688](https://github.com/LFDT-Verii/core/pull/688) Unified Node.js SDK error handling

The Node.js wallet SDK now uses the same error taxonomy as the mobile SDKs, so wallet integrations can handle stable, machine-readable error codes across issuing and presentation flows. Errors include validation phase and request context to make failures easier to route, log, and troubleshoot.

For teams that need more time to migrate existing error handling, `VCLInitializationDescriptor` supports `errorCodeCompatibilityMode: 'legacy'` to preserve the previous error-code behavior.

## Backward incompatibilities

By default, the Node.js wallet SDK now returns taxonomy error codes with validation-phase and request-context fields on `VCLError`. Set `errorCodeCompatibilityMode: 'legacy'` on `VCLInitializationDescriptor` to preserve the previous error-code behavior while migrating.
