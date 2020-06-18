const { Treinador, Aluno, Aula, Presenca, Financa, Mensalidade, AulaHasAluno } = require('../models');
const bcrypt = require('bcrypt')
const Sequelize = require('sequelize');
const Op = Sequelize.Op;
const multer = require('multer');
const { json, JSON } = require('sequelize');
const { formatDate, addDias } = require('../helpers/funcoes');
const helpers = require('../helpers/funcoes');
const { where } = require('sequelize');


module.exports = {
    showLogin: (req, res) => {
        res.render("login");
    },
    //####################################################################################################################################
    showCrie: async (req, res) => {
        let user = req.session.usuario;


        let aulas = await Aula.findAndCountAll({
            //     attributes: ['data_aula'],
            group: ['data_aula'],
            where: {
                treinadores_id: user.id

            },
            include:
                [
                    {
                        model: Aluno,
                        as: 'aluno',
                        include: 'aula'
                    },
                ],
            raw: true
        })
        
        
        let periodo = await helpers.periodo()
        // atualizando o array criado acima com as aulas cadastradas no banco EX: 16/6/2020 ---- 1 aula, 21/6/2020 ---- 2 aula
        for await (dia of periodo) {
            for (qtde of aulas.count) {
                if (dia.data === helpers.formatDate(qtde.data_aula)) {
                    console.log(dia.data, helpers.formatDate(qtde.data_aula), true)
                    dia.qtde = await parseInt(qtde.count)
                }
            }
        }

        let aulas_alunos = await Aula.findAndCountAll({
            //     attributes: ['data_aula'],
            where: {
                treinadores_id: user.id

            },
            include:
                [
                    {
                        model: Aluno,
                        as: 'aluno',
                        include: 'aula'
                    },
                ],
            raw: true
        })
        console.log(aulas_alunos.rows);
        
        console.log('==================================================================')
        res.render("crie", { user, periodo, aulas:aulas_alunos.rows });
    },

    showAlunos: async (req, res) => {
        let user = req.session.usuario;

        let alunos = await Aluno.findAll({
            where: {
                treinadores_id: user.id
            }
        })
        console.log(alunos)
        res.render("alunos", { user, alunos });
    },

    showCadastroAluno: (req, res) => {
        res.render('cadastrarAlunos');
    },
    showNovoAluno: async (req, res) => {
        let treinadores_id = req.session.usuario.id;

        // console.log('=================> ' + req.file)
        //Capturar as info enviadas pelo usuário
        let { nome, email, telefone, meta, plano, tempo_plano, valor } = req.body
        let img = `/img/${req.file.originalname}`;
        const resultado = await Aluno.create({
            img,
            nome,
            email,
            telefone,
            meta,
            treinadores_id,
            plano,
            tempo_plano,
            valor
        })


    
        if (plano == "Mensal") {
            let hoje = new Date();
            let objPags = helpers.diasMeses(hoje,tempo_plano)

            console.log(objPags);
            
            for (data of objPags.data) {

                await Mensalidade.create({
                    mes_ref: data,
                    valor,
                    alunos_id: resultado.id,
                    treinadores_id,
                    status: 0
                })
            }
        } else {
            let intervalo = 1 + parseInt(tempo_plano)
            for (let i = 1; i < intervalo; i++) {
                await Mensalidade.create({
                    mes_ref: `Dia ${i}`,
                    valor,
                    alunos_id: resultado.id,
                    treinadores_id,
                    status: 0
                })
            }
        }
        //    console.log(resultado)
        //Redirecionar o usuário para a lista de alunos
        res.redirect("/home/alunos")
    },

    showNovaAula: async (req, res) => {
        let alunos = await Aluno.findAll();
        res.render('novaAula', { alunos });
    },

    criarNovaAula: async (req, res) => {
        let treinadores_id = req.session.usuario.id;
        let { nome, observacoes, alunos_id, data_aula, horario } = req.body;


        await Aula.create({
            nome,
            observacoes,
            treinadores_id,
            alunos_id,
            data_aula,
            horario,
            status: 'a'
        })


        res.redirect("/home")
    },
    showTreino: async (req, res) => {
        let user = req.session.usuario;
        let data = new Date();
        let meses = new Array(
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        );
        let mes = meses[data.getMonth()];
        let ano = data.getFullYear();

        let aluno = await Aluno.findOne({
            where: {
                id: req.params.id
            }
        });

        let mensalidades = await Mensalidade.findAll({
            where: {
                alunos_id: req.params.id,
                treinadores_id: user.id
            }
        });


        if (aluno) {
            res.render("treino", { aluno, mensalidades, mes, ano });
        } else {
            res.render("404")
        }
    },
    showMensalidades: async (req, res) => {
        let treinadores_id = req.session.usuario.id;
        let alunos_id = req.params.id;
        let { valor, pago } = req.body;
        let data = new Date();
        let meses = new Array(
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        );
        let mes = meses[data.getMonth()];
        let ano = data.getFullYear();

        await Mensalidade.create({
            valor,
            pago,
            mes_ref: mes,
            ano,
            treinadores_id,
            alunos_id
        })


        res.redirect('/home/treino/' + alunos_id)
    },
    showDelMensalidades: async (req, res) => {
        let resultado = await Mensalidade.destroy({
            where: {
                id: req.params.id
            }
        });

        return res.redirect('/home/alunos')
    },
    salvarPagamento: async (req, res) => {
        let { pago, mes_ref, aluno } = req.body;
        console.log(req.body);

        await Mensalidade.update(
            {
                status: pago
            }, {
            where: {
                id: mes_ref
            }
        }
        )

        return res.redirect(`/home/treino/${aluno}`)
    },
    editarAlunos: async (req, res) => {
        let user = req.session.usuario;

        let aluno = await Aluno.findOne({
            where: {
                id: req.params.id
            }
        })

        if (aluno) {
            res.render("editarAluno", { aluno });
        } else {
            res.render("404")
        }

    },
    showUpdateAlunos: async (req, res) => {
        let user = req.session.usuario;
        let { nome, email, telefone, meta, metaFeita } = req.body
        let edicao = await Aluno.update({
            nome,
            email,
            telefone,
            meta,
            metaFeita,
            treinadores_id: user.id
        }, {
            where: {
                id: req.params.id
            }
        });


        return res.redirect('/home/alunos/' + req.params.id);
    },
    showDeleteAlunos: async (req, res) => {
        3
        let resultado = await Aluno.destroy({
            where: {
                id: req.params.id
            }
        });

        return res.redirect('/home/alunos')
    },
    showFinancas: async (req, res) => {
        let user = req.session.usuario;
        let data = new Date();
        let meses = new Array(
            'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
        );
        let mes = meses[data.getMonth()];
        let ano = data.getFullYear();

        let pendentes = await Mensalidade.sum('valor', {
            where: {
                treinadores_id: user.id,
                pago: 0,
                mes_ref: mes,
                // ano
            }
        });

        let pagos = await Mensalidade.sum('valor', {
            where: {
                treinadores_id: user.id,
                pago: 1,
                mes_ref: mes,
                // ano
            }
        });

        res.render("financas", { user, pagos, pendentes, mes, ano });
    },
    search: async (req, res) => {
        let user = req.session.usuario;
        let busca = req.query.q;
        if (busca) {
            let result = await Aluno.findAll(
                {
                    where: {
                        nome: {
                            [Op.substring]: busca
                        },
                        treinadores_id: user.id
                    }
                });

            return res.render('alunos', { alunos: result });
        } else {
            return res.redirect('/home/alunos');
        }
    },
    login: async (req, res) => {
        // Lendo as info do body
        const { email, senha } = req.body;

        // console.log(req.body)
        //Tentar carregar um usuário
        const user = await Treinador.findOne({ where: { email } });


        // Verificar se existe usuario com email passado
        if (!user) {
            req.flash('menssage', 'Email não cadastrado!')
            res.redirect('/login');
        }

        // Validar a senha passada via post contra a guardada no banco
        if (!bcrypt.compareSync(senha, user.senha)) {
            req.flash('menssage', 'Senha Inválida!')
            res.redirect('/login');
        }

        // Setar uma session com o usuario
        req.session.usuario = user;

        //Redirecionar o usuario para a rota home
        res.redirect('/home')

    },
    logout: (req, res) => {
        req.session.destroy();
        res.redirect('/login')
    }
}