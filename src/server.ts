import fastify from 'fastify'
import { createTrip } from './routes/create-trip'
import { serializerCompiler, validatorCompiler } from 'fastify-type-provider-zod';
import cors from '@fastify/cors'

const app = fastify()

app.register(cors, {
    origin: '*'
})

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

app.register(createTrip)

app.listen({ port: 3333, host: '0.0.0.0' }).then(() => {
    console.log('🔥 HTTP Server Running!')
})