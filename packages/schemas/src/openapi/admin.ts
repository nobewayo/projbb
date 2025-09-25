import type { OpenAPIV3_1 } from 'openapi-types';

export const adminStateOpenApiDocument: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: {
    title: 'Bitby Admin API',
    version: '0.1.0',
    description: 'Administrative endpoints for development overrides.',
  },
  paths: {
    '/admin/rooms/{roomId}/state': {
      get: {
        summary: 'Fetch the current admin quick menu state for a room',
        operationId: 'getAdminState',
        parameters: [
          {
            name: 'roomId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: {
          '200': {
            description: 'Admin state payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'showGrid',
                    'showHoverWhenGridHidden',
                    'moveAnimationsEnabled',
                    'latencyTraceEnabled',
                    'lockTilesEnabled',
                    'noPickupEnabled',
                    'updatedAt',
                  ],
                  properties: {
                    showGrid: { type: 'boolean' },
                    showHoverWhenGridHidden: { type: 'boolean' },
                    moveAnimationsEnabled: { type: 'boolean' },
                    latencyTraceEnabled: { type: 'boolean' },
                    lockTilesEnabled: { type: 'boolean' },
                    noPickupEnabled: { type: 'boolean' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    updatedBy: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Missing or invalid bearer token',
          },
          '404': {
            description: 'Room not found',
          },
        },
      },
      patch: {
        summary: 'Update one or more admin quick menu flags',
        operationId: 'updateAdminState',
        parameters: [
          {
            name: 'roomId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  showGrid: { type: 'boolean' },
                  showHoverWhenGridHidden: { type: 'boolean' },
                  moveAnimationsEnabled: { type: 'boolean' },
                  latencyTraceEnabled: { type: 'boolean' },
                  lockTilesEnabled: { type: 'boolean' },
                  noPickupEnabled: { type: 'boolean' },
                },
                minProperties: 1,
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Updated admin state',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: [
                    'showGrid',
                    'showHoverWhenGridHidden',
                    'moveAnimationsEnabled',
                    'latencyTraceEnabled',
                    'lockTilesEnabled',
                    'noPickupEnabled',
                    'updatedAt',
                  ],
                  properties: {
                    showGrid: { type: 'boolean' },
                    showHoverWhenGridHidden: { type: 'boolean' },
                    moveAnimationsEnabled: { type: 'boolean' },
                    latencyTraceEnabled: { type: 'boolean' },
                    lockTilesEnabled: { type: 'boolean' },
                    noPickupEnabled: { type: 'boolean' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    updatedBy: { type: 'string', nullable: true },
                  },
                },
              },
            },
          },
          '400': { description: 'Payload rejected' },
          '401': { description: 'Missing or invalid bearer token' },
          '404': { description: 'Room not found' },
        },
      },
    },
  },
  components: {},
};
