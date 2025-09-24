import type { OpenAPIV3_1 } from 'openapi-types';

export const authLoginOpenApiDocument: OpenAPIV3_1.Document = {
  openapi: '3.1.0',
  info: {
    title: 'Bitby Auth API',
    version: '0.1.0',
    description: 'Authentication endpoints for the Bitby development environment.',
  },
  paths: {
    '/auth/login': {
      post: {
        summary: 'Authenticate a user and issue a JWT',
        operationId: 'login',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', minLength: 1, maxLength: 64 },
                  password: { type: 'string', minLength: 1, maxLength: 256 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Login succeeded',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['token', 'expiresIn', 'user'],
                  properties: {
                    token: { type: 'string' },
                    expiresIn: { type: 'integer', minimum: 60 },
                    user: {
                      type: 'object',
                      additionalProperties: false,
                      required: ['id', 'username', 'roles'],
                      properties: {
                        id: { type: 'string' },
                        username: { type: 'string' },
                        roles: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': {
            description: 'Invalid request payload',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['message'],
                  properties: {
                    message: { type: 'string' },
                    issues: {
                      type: 'array',
                      items: { type: 'object' },
                    },
                  },
                },
              },
            },
          },
          '401': {
            description: 'Authentication failed',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['message'],
                  properties: {
                    message: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
  components: {},
};
