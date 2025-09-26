import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import type { ServerConfig } from '../config.js';
import type { UserStore } from '../auth/store.js';
import { signToken } from '../auth/jwt.js';

const loginSchema = z.object({
  username: z.string().min(1, 'username is required').max(64),
  password: z.string().min(1, 'password is required').max(256),
});

interface AuthPluginOptions {
  config: ServerConfig;
  userStore: UserStore;
}

export const authRoutes: FastifyPluginAsync<AuthPluginOptions> = async (
  app: FastifyInstance,
  options: AuthPluginOptions,
): Promise<void> => {
  const { config, userStore } = options;

  app.post('/auth/login', async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      await reply.code(400).send({
        message: 'Invalid login payload',
        issues: parsed.error.issues,
      });
      return;
    }

    const { username, password } = parsed.data;
    const user = await userStore.findUserByUsername(username);
    if (!user) {
      await reply.code(401).send({ message: 'Invalid username or password' });
      return;
    }

    const passwordIsValid = await userStore.verifyUserPassword(user, password);
    if (!passwordIsValid) {
      await reply.code(401).send({ message: 'Invalid username or password' });
      return;
    }

    const publicUser = userStore.toPublicUser(user);
    const token = signToken(publicUser, config);

    reply.header('Cache-Control', 'no-store');
    await reply.send({
      token,
      expiresIn: config.TOKEN_TTL_SECONDS,
      user: publicUser,
    });
  });
};
