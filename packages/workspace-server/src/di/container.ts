import "reflect-metadata";
import { Container } from "inversify";
import { GitService } from "../services/git/service";
import { TOKENS } from "./tokens";

export const container = new Container();
container.bind(TOKENS.GitService).to(GitService).inSingletonScope();
