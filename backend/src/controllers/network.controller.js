import { getNetwork } from '../services/network.service.js';
import { prisma } from '../config/prisma.js';
import { decryptText } from '../services/encryption.service.js';

export async function network(req, res, next) {
  try {
    res.json(await getNetwork(req.user.id));
  } catch (error) { next(error); }
}

export async function documentContent(req, res, next) {
  try {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id <= 0) return res.status(400).json({ error: 'ID de documento inválido.' });
    const doc = await prisma.document.findFirst({ where: { id, deletedAt: null }, select: { id: true, originalName: true, extractedText: true } });
    if (!doc) return res.status(404).json({ error: 'Documento no encontrado.' });
    res.json({ id: doc.id, name: doc.originalName, content: decryptText(doc.extractedText) || '' });
  } catch (error) { next(error); }
}
