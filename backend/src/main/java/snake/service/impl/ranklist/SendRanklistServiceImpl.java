package snake.service.impl.ranklist;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.alibaba.fastjson2.JSONObject;
import com.baomidou.mybatisplus.core.conditions.query.QueryWrapper;

import snake.mapper.RankInfoMapper;
import snake.pojo.Rankinfo;
import snake.service.ranklist.SendRanklistService;

@Service
public class SendRanklistServiceImpl implements SendRanklistService {

    @Autowired
    private RankInfoMapper RankInfoMapper;

    @Override
    public JSONObject sendRanklist() {
        QueryWrapper<Rankinfo> wrapper = new QueryWrapper<>();
        wrapper.orderByDesc("score");
        JSONObject res = new JSONObject();
        res.put("data", RankInfoMapper.selectList(wrapper));
        res.put("status", "success");
        res.put("message", "获取消息成功");
        return res;
    }
}
