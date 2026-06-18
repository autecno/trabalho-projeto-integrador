"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { apiFetch, getFriendlyErrorMessage, readApiJson } from "@/lib/api";
import { getValidStoredToken } from "@/lib/auth";

type ContentDetail = {
  id: number;
  moduleId: number;
  title: string;
  type: 'video' | 'text';
  youtubeUrl: string | null;
  summary: string | null;
  body: string | null;
};

function getYoutubeEmbedUrl(url: string) {
  const match = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}

export default function ContentPage() {
  const params = useParams<{ moduleId: string; contentId: string }>();
  const router = useRouter();
  const token = getValidStoredToken();
  const [content, setContent] = useState<ContentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const moduleId = Number(params.moduleId);
  const contentId = Number(params.contentId);
  const invalidParams =
    !Number.isFinite(moduleId) ||
    moduleId <= 0 ||
    !Number.isFinite(contentId) ||
    contentId <= 0;
  const validationError = invalidParams ? 'Parâmetros inválidos.' : null;

  useEffect(() => {
    if (!token) {
      router.replace('/auth/login');
      return;
    }

    if (invalidParams) {
      return;
    }

    const loadContent = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch(`/learning/contents/${contentId}`);
        const payload = await readApiJson<ContentDetail>(
          response,
          'Não foi possível carregar o conteúdo.',
        );

        setContent(payload);

        if (payload.type === 'video') {
          await apiFetch(`/learning/contents/${contentId}/progress`, {
            method: 'POST',
          });
        }
      } catch (err) {
        setError(
          getFriendlyErrorMessage(err, 'Falha ao carregar o conteúdo.'),
        );
      } finally {
        setLoading(false);
      }
    };

    loadContent();
  }, [token, contentId, invalidParams, router]);

  const embedUrl = content?.youtubeUrl ? getYoutubeEmbedUrl(content.youtubeUrl) : null;

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-28">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold text-slate-900">{content?.title ?? 'Conteúdo'}</h1>
          <p className="mt-2 text-slate-600">{content?.summary}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/learning/${moduleId}`}>
            <Button variant="outline">Voltar ao módulo</Button>
          </Link>
          <Link href="/learning">
            <Button variant="outline">Todos os conteúdos</Button>
          </Link>
        </div>
      </div>

      {loading && <p>Carregando conteúdo...</p>}
      {(error || validationError) && (
        <p className="text-rose-600">{error ?? validationError}</p>
      )}

      {content && (
        <div className="space-y-6">
          {content.type === 'video' && embedUrl ? (
            <Card>
              <div className="aspect-video overflow-hidden rounded-3xl bg-black">
                <iframe
                  className="h-full w-full"
                  src={embedUrl}
                  title={content.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
              {content.summary && (
                <div className="mt-4 text-slate-700">
                  <h2 className="text-lg font-semibold text-slate-900">Resumo do vídeo</h2>
                  <p className="mt-2 whitespace-pre-line">{content.summary}</p>
                </div>
              )}
            </Card>
          ) : null}

          {content.type === 'text' && (
            <Card>
              <div className="space-y-4">
                <div className="space-y-4 text-slate-700 whitespace-pre-line">
                  {content.body}
                </div>
              </div>
            </Card>
          )}
        </div>
      )}
    </main>
  );
}
