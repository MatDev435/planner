import type { FastifyInstance } from 'fastify'
import { ZodTypeProvider } from 'fastify-type-provider-zod'
import { z } from 'zod'
import dayjs from 'dayjs'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import 'dayjs/locale/pt-br'
import { prisma } from '../lib/prisma'
import { getMailClient } from '../lib/mail'
import nodemailer from 'nodemailer'

dayjs.locale('pt-br')
dayjs.extend(localizedFormat)

export async function createTrip(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post('/trips', {
        schema: {
            body: z.object({
                destination: z.string().min(4),
                startsAt: z.coerce.date(),
                endsAt: z.coerce.date(),
                ownerName: z.string(),
                ownerEmail: z.string().email(),
                emailsToInvite: z.array(z.string().email()),
            })
        }
    }, async (request, reply) => {
        const { destination, startsAt, endsAt, ownerName, ownerEmail, emailsToInvite } = request.body

        if (dayjs(startsAt).isBefore(new Date())) {
            throw new Error('Invalid trip start date')
        }

        if (dayjs(endsAt).isBefore(startsAt)) {
            throw new Error('Invalid trip end date')
        }

        const trip = await prisma.trip.create({
            data: {
                destination,
                startsAt,
                endsAt,
                participants: {
                    createMany: {
                        data: [
                            {
                                name: ownerName,
                                email: ownerEmail,
                                isOwner: true,
                                isConfirmed: true,
                            },
                            ...emailsToInvite.map(email => {
                                return { email }
                            })
                        ]
                    }
                }
            }
        })

        const formattedStartDate = dayjs(startsAt).format('LL')
        const formattedEndDate = dayjs(endsAt).format('LL')

        const confirmationLink = `http://localhost:3333/trips/${trip.id}/confirm`

        const mail = await getMailClient()

        const message = await mail.sendMail({
            from: {
                name: 'Equipe Plann.er',
                address: 'oi@plann.er'
            },
            to: {
                name: ownerName,
                address: ownerEmail,
            },
            subject: `Confirme sua viagem para ${destination} em ${formattedStartDate}`,
            html: `
                <div>
                    <h1>Plann.er</h1>

                    <p>Faaaala ${ownerName}, tudo bem?</p>

                    <p>Você acabou de agendar uma viagem com destino a ${destination}</p>

                    <p>Início: ${formattedStartDate}</p>
                    <p>Término: ${formattedEndDate}</p>

                    <p>Para confirmar sua viagem, clique no botão abaixo</p>

                    <p>
                        <a href="${confirmationLink}">Confirmar viagem</a>
                    </p>

                    <p>Obrigado por escolher o Plann.er 💗</p>

                    <p>Caso você não tenha agendado uma viagem, apenas ignore esse e-mail</p>
                </div>
            `.trim()
        })

        console.log(nodemailer.getTestMessageUrl(message))

        return reply.status(201).send({ tripId: trip.id })
    })
}