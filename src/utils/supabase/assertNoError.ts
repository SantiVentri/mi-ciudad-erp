import 'server-only'

/**
 * Lanza un error si Supabase devolvió un error real (no "sin resultados").
 * Al tirar la excepción, el Server Component que llamó a esta función
 * también falla, y Next.js muestra el error.tsx más cercano en vez de
 * renderizar la página como si simplemente no hubiera datos.
 */
export function assertNoSupabaseError(error: { message: string } | null, context: string): void {
    if (error) {
        throw new Error(`${context}: ${error.message}`)
    }
}