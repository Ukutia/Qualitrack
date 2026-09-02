import { prisma } from '../config/prisma.js';

export async function listTopics(req, res, next) {
  try {
    const topics = await prisma.topic.findMany({
      where: {
        createdById: req.user.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return res.json({
      count: topics.length,
      topics,
    });
  } catch (error) {
    return next(error);
  }
}

export async function createTopic(req, res, next) {
  try {
    const { name } = req.body || {};

    if (!name || typeof name !== 'string') {
      return res.status(400).json({
        error: 'El nombre de la temática es obligatorio.',
      });
    }

    const cleanName = name.trim();

    if (cleanName.length < 3) {
      return res.status(400).json({
        error: 'La temática debe tener al menos 3 caracteres.',
      });
    }

    const documentCount = await prisma.documentChunk.count({
      where: {
        document: {
          deletedAt: null,
          uploadedById: req.user.id,
        },
      },
    });

    if (documentCount === 0) {
      return res.status(409).json({
        error:
          'No existen documentos para asociar temáticas. Comience a agregar documentos.',
      });
    }

    const topic = await prisma.topic.create({
      data: {
        name: cleanName,
        createdById: req.user.id,
      },
    });

    return res.status(201).json({
      message: 'Temática creada correctamente.',
      topic,
    });
  } catch (error) {
    return next(error);
  }
}

export async function deleteTopic(req, res, next) {
  try {
    const topicId = Number(req.params.id);

    if (!Number.isInteger(topicId) || topicId <= 0) {
      return res.status(400).json({
        error: 'ID de temática inválido.',
      });
    }

    const topic = await prisma.topic.findFirst({
      where: {
        id: topicId,
        createdById: req.user.id,
      },
    });

    if (!topic) {
      return res.status(404).json({
        error: 'Temática no encontrada.',
      });
    }

    await prisma.topic.delete({
      where: {
        id: topicId,
      },
    });

    return res.json({
      message: 'Temática eliminada correctamente.',
    });
  } catch (error) {
    return next(error);
  }
}