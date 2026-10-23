export default class ValidadorCNPJ {
    validar(cnpj: string): boolean {
        const valor = cnpj.replace(/\D/g, "");

        if (valor.length !== 14 || /^([0-9])\1+$/.test(valor)) {
            return false;
        }

        const calcular = (tamanho: number): number => {
            let soma = 0;
            let posicao = tamanho - 7;

            for (let i = tamanho; i >= 1; i--) {
                soma += Number(valor[tamanho - i]) * posicao--;
                if (posicao < 2) posicao = 9;
            }

            const resultado = soma % 11;
            return resultado < 2 ? 0 : 11 - resultado;
        };

        return calcular(12) === Number(valor[12])
            && calcular(13) === Number(valor[13]);
    }
}