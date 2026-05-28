import "reflect-metadata";
import { Container } from "inversify";
import { FsService } from "../services/fs/service";
import { GitService } from "../services/git/service";
import { WatcherService } from "../services/watcher/service";
import { TOKENS } from "./tokens";

export const container = new Container();
container.bind(TOKENS.GitService).to(GitService).inSingletonScope();
container.bind(TOKENS.FsService).to(FsService).inSingletonScope();
container.bind(TOKENS.WatcherService).to(WatcherService).inSingletonScope();
