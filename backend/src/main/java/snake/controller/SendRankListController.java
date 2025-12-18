package snake.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import com.alibaba.fastjson2.JSONObject;

import snake.service.ranklist.SendRanklistService;
@RestController
public class SendRankListController {

    @Autowired
    private SendRanklistService sendRanklistService;

    @PostMapping("/ranklist/get/")
    public JSONObject updateRanklist() {
        return sendRanklistService.sendRanklist();
    }
}
